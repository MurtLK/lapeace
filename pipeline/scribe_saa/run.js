// Batch-transcribe Speech Accent Archive clips with ElevenLabs Scribe and score WER.
//
// Usage:
//   node run.js --dataset <SAA folder> --clips urdu5            # specific clip(s), comma-separated
//   node run.js --dataset <SAA folder> --per-group 3            # pilot: first N clips of every group
//   node run.js --dataset <SAA folder> --all                    # full batch
// Options: --out <dir> (default ../../results/scribe_saa), --concurrency N (default 3),
//          --max-requests N (hard cap on live API calls this run), --dry-run (no API calls).
//
// API key: ELEVENLABS_API_KEY env var only. Never logged or saved.
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { wordErrors } from './wer.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const API_URL = 'https://api.elevenlabs.io/v1/speech-to-text';

// Request settings. Any change here changes the cache key, so old results are not reused.
const SETTINGS = {
  model_id: 'scribe_v2',
  language_code: 'en',
  tag_audio_events: false,
  keyterms: [], // intentionally empty: the reference paragraph is used only for scoring
};
const SETTINGS_HASH = createHash('sha256').update(JSON.stringify(SETTINGS)).digest('hex').slice(0, 10);

const { values: args } = parseArgs({
  options: {
    dataset: { type: 'string' },
    out: { type: 'string', default: path.join(here, '..', '..', 'results', 'scribe_saa') },
    clips: { type: 'string' },
    'per-group': { type: 'string' },
    all: { type: 'boolean', default: false },
    concurrency: { type: 'string', default: '3' },
    'max-requests': { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
});

function fail(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

// Minimal CSV parser (quoted fields, commas, escaped quotes).
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(rows, columns) {
  return [columns.join(','), ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n';
}

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

function loadApiKey() {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  return key || null;
}

async function transcribe(apiKey, audioPath) {
  const form = new FormData();
  form.append('model_id', SETTINGS.model_id);
  form.append('language_code', SETTINGS.language_code);
  form.append('tag_audio_events', String(SETTINGS.tag_audio_events));
  // keyterms left empty -> not sent
  const bytes = await readFile(audioPath);
  form.append('file', new Blob([bytes], { type: 'audio/mpeg' }), path.basename(audioPath));
  const res = await fetch(API_URL, { method: 'POST', headers: { 'xi-api-key': apiKey }, body: form });
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
  return JSON.parse(body);
}

async function main() {
  if (!args.dataset) fail('--dataset <Speech Accent Archive folder> is required');
  const selectors = [args.clips, args['per-group'], args.all].filter(Boolean).length;
  if (selectors !== 1) fail('choose exactly one of --clips, --per-group, --all');

  const dataset = path.resolve(args.dataset);
  const reference = (await readFile(path.join(dataset, 'elicitation_paragraph.txt'), 'utf8')).trim();
  const metadata = parseCsv(await readFile(path.join(dataset, 'metadata.csv'), 'utf8'));
  const all = metadata.map((m) => ({
    clip_id: path.basename(m.file, path.extname(m.file)),
    file: m.file,
    speaker_group: m.language,
    meta: m,
  }));

  let selected;
  if (args.clips) {
    const wanted = args.clips.split(',').map((s) => s.trim()).filter(Boolean);
    selected = all.filter((c) => wanted.includes(c.clip_id));
    const unknown = wanted.filter((w) => !all.some((c) => c.clip_id === w));
    if (unknown.length) fail(`unknown clip ids: ${unknown.join(', ')}`);
  } else if (args['per-group']) {
    const n = Number(args['per-group']);
    const seen = {};
    selected = all.filter((c) => (seen[c.speaker_group] = (seen[c.speaker_group] || 0) + 1) <= n);
  } else selected = all;

  const outDir = path.resolve(args.out);
  const cacheDir = path.join(outDir, 'cache');
  await mkdir(cacheDir, { recursive: true });

  const apiKey = args['dry-run'] ? null : loadApiKey();
  if (!args['dry-run'] && !apiKey) fail('ELEVENLABS_API_KEY is not set in the environment');

  const maxRequests = args['max-requests'] ? Number(args['max-requests']) : Infinity;
  let requestsMade = 0;
  const results = [], problems = [];
  let cached = 0;

  async function processClip(c) {
    const audioPath = path.join(dataset, c.file);
    if (!(await exists(audioPath))) {
      problems.push({ clip_id: c.clip_id, speaker_group: c.speaker_group, file: c.file, kind: 'missing_file', detail: '' });
      return;
    }
    const audioHash = createHash('sha256').update(await readFile(audioPath)).digest('hex').slice(0, 12);
    const cacheFile = path.join(cacheDir, `${c.clip_id}__${audioHash}__${SETTINGS_HASH}.json`);
    let response;
    if (await exists(cacheFile)) {
      response = JSON.parse(await readFile(cacheFile, 'utf8')).response;
      cached++;
    } else if (args['dry-run']) {
      problems.push({ clip_id: c.clip_id, speaker_group: c.speaker_group, file: c.file, kind: 'not_run_dry_run', detail: '' });
      return;
    } else if (requestsMade >= maxRequests) {
      problems.push({ clip_id: c.clip_id, speaker_group: c.speaker_group, file: c.file, kind: 'skipped_max_requests', detail: '' });
      return;
    } else {
      requestsMade++;
      try {
        response = await transcribe(apiKey, audioPath);
      } catch (err) {
        problems.push({ clip_id: c.clip_id, speaker_group: c.speaker_group, file: c.file, kind: 'request_failed', detail: err.message });
        return;
      }
      await writeFile(cacheFile, JSON.stringify({ clip_id: c.clip_id, settings: SETTINGS, audio_sha256_12: audioHash, response }, null, 2));
    }
    const transcript = (response.text || '').trim();
    const e = wordErrors(reference, transcript);
    results.push({
      clip_id: c.clip_id,
      speaker_group: c.speaker_group,
      reference,
      raw_transcript: transcript,
      wer: e.wer.toFixed(4),
      substitutions: e.substitutions,
      deletions: e.deletions,
      insertions: e.insertions,
      reference_words: e.reference_words,
      detected_language: response.language_code ?? '',
      model_id: SETTINGS.model_id,
      gender: c.meta.gender,
      age: c.meta.age,
      english_onset_age: c.meta.english_onset_age,
      length_of_english_residence_years: c.meta.length_of_english_residence_years,
      duration_sec: c.meta.duration_sec,
    });
  }

  // Small worker pool.
  const queue = [...selected];
  const workers = Array.from({ length: Math.max(1, Number(args.concurrency)) }, async () => {
    while (queue.length) await processClip(queue.shift());
  });
  await Promise.all(workers);

  const order = new Map(all.map((c, i) => [c.clip_id, i]));
  results.sort((a, b) => order.get(a.clip_id) - order.get(b.clip_id));

  const resultColumns = ['clip_id', 'speaker_group', 'reference', 'raw_transcript', 'wer', 'substitutions', 'deletions',
    'insertions', 'reference_words', 'detected_language', 'model_id', 'gender', 'age', 'english_onset_age',
    'length_of_english_residence_years', 'duration_sec'];
  await writeFile(path.join(outDir, 'transcripts.csv'), toCsv(results, resultColumns));

  const groups = {};
  for (const r of results) (groups[r.speaker_group] ||= []).push(Number(r.wer));
  const summary = Object.entries(groups)
    .map(([g, w]) => ({ speaker_group: g, clips: w.length, mean_wer: (w.reduce((a, b) => a + b, 0) / w.length).toFixed(4) }))
    .sort((a, b) => b.mean_wer - a.mean_wer);
  await writeFile(path.join(outDir, 'summary_by_group.csv'), toCsv(summary, ['speaker_group', 'clips', 'mean_wer']));
  await writeFile(path.join(outDir, 'problems.csv'), toCsv(problems, ['clip_id', 'speaker_group', 'file', 'kind', 'detail']));

  console.log(`Selected ${selected.length} clips | scored ${results.length} | new API requests ${requestsMade} | from cache ${cached} | problems ${problems.length}`);
  console.log(`Settings ${JSON.stringify(SETTINGS)} (hash ${SETTINGS_HASH})`);
  console.log(`Wrote ${path.join(outDir, 'transcripts.csv')}, summary_by_group.csv, problems.csv`);
  if (results.length === 1) {
    const r = results[0];
    console.log(`\nREFERENCE:\n${r.reference}\n\nRAW TRANSCRIPT (${r.clip_id}, ${r.speaker_group}):\n${r.raw_transcript}`);
    console.log(`\nWER ${r.wer}  (S=${r.substitutions} D=${r.deletions} I=${r.insertions} / N=${r.reference_words})`);
  }
  if (problems.length) console.log(`See problems.csv for ${problems.length} unprocessed clips.`);
}

main().catch((err) => fail(err.message));
