// Transcribe the locked A/B evaluation set with a local whisper.cpp model (no API, no credentials).
//
//   node run.js --audio-dir <SAA audio folder> --model <ggml model .bin>
//               [--eval-set ../../results/ab_whisper/eval_set.csv] [--out ../../results/ab_whisper]
//               [--concurrency 2] [--limit N]
//
// Only rows with include=1 are run. Each output is cached by clip + audio hash + settings hash,
// so reruns skip finished clips. Writes <out>/whisper_transcripts.csv (clip_id, speaker_group, transcript).
import { readFile, writeFile, mkdir, access, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const { values: args } = parseArgs({
  options: {
    'audio-dir': { type: 'string' },
    model: { type: 'string' },
    'eval-set': { type: 'string', default: path.join(here, '..', '..', 'results', 'ab_whisper', 'eval_set.csv') },
    out: { type: 'string', default: path.join(here, '..', '..', 'results', 'ab_whisper') },
    concurrency: { type: 'string', default: '2' },
    limit: { type: 'string' },
  },
});
if (!args['audio-dir'] || !args.model) {
  console.error('Usage: node run.js --audio-dir <folder> --model <ggml .bin>');
  process.exit(1);
}

function parseCsv(text) {
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') q = false; else field += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); field = ''; if (row.length > 1 || row[0]) rows.push(row); row = []; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [h, ...b] = rows;
  return b.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ''])));
}
const cell = (v) => (/[",\n\r]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

const modelPath = path.resolve(args.model);
const modelHash = createHash('sha256').update(await readFile(modelPath)).digest('hex').slice(0, 12);
const { stdout: ver } = await run('whisper-cli', ['--version']).catch(() => ({ stdout: 'unknown' }));
// Settings that affect output. Changing any of them invalidates the cache.
const SETTINGS = {
  engine: 'whisper.cpp',
  engine_version: ver.trim().replace(/^whisper\.cpp version:\s*/, ''),
  model: path.basename(modelPath),
  model_sha256_12: modelHash,
  language: 'en',
  beam_size: 5, // whisper-cli default
  prompt: null,
  vad: false,
};
const settingsHash = createHash('sha256').update(JSON.stringify(SETTINGS)).digest('hex').slice(0, 10);

const evalSet = parseCsv(await readFile(path.resolve(args['eval-set']), 'utf8')).filter((r) => r.include === '1');
const selected = args.limit ? evalSet.slice(0, Number(args.limit)) : evalSet;
const outDir = path.resolve(args.out);
const cacheDir = path.join(outDir, 'whisper_cache');
const tmpDir = path.join(outDir, '.tmp');
await mkdir(cacheDir, { recursive: true });
await mkdir(tmpDir, { recursive: true });
const exists = (p) => access(p).then(() => true, () => false);

let fresh = 0, cached = 0;
const failures = [];
async function processClip(r) {
  const audio = path.join(path.resolve(args['audio-dir']), r.audio_file);
  if (!(await exists(audio))) { failures.push({ clip_id: r.clip_id, reason: 'missing audio' }); return; }
  const audioHash = createHash('sha256').update(await readFile(audio)).digest('hex').slice(0, 12);
  const cacheFile = path.join(cacheDir, `${r.clip_id}__${audioHash}__${settingsHash}.json`);
  if (await exists(cacheFile)) { cached++; return; }
  const base = path.join(tmpDir, r.clip_id);
  const t0 = Date.now();
  try {
    await run('whisper-cli', ['-m', modelPath, '-l', 'en', '-nt', '-np', '-otxt', '-of', base, '-f', audio], { maxBuffer: 1 << 24 });
    const text = (await readFile(`${base}.txt`, 'utf8')).replace(/\s+/g, ' ').trim();
    await writeFile(cacheFile, JSON.stringify({ clip_id: r.clip_id, settings: SETTINGS, audio_sha256_12: audioHash, seconds: (Date.now() - t0) / 1000, text }, null, 2));
    fresh++;
    process.stdout.write(`${r.clip_id} (${((Date.now() - t0) / 1000).toFixed(1)}s) `);
  } catch (err) {
    failures.push({ clip_id: r.clip_id, reason: String(err.message).slice(0, 200) });
  } finally {
    await rm(`${base}.txt`, { force: true });
  }
}

const queue = [...selected];
await Promise.all(Array.from({ length: Math.max(1, Number(args.concurrency)) }, async () => {
  while (queue.length) await processClip(queue.shift());
}));

// Rebuild the CSV from cache so it always reflects every finished clip.
const rows = [];
for (const r of evalSet) {
  const audio = path.join(path.resolve(args['audio-dir']), r.audio_file);
  if (!(await exists(audio))) continue;
  const audioHash = createHash('sha256').update(await readFile(audio)).digest('hex').slice(0, 12);
  const f = path.join(cacheDir, `${r.clip_id}__${audioHash}__${settingsHash}.json`);
  if (await exists(f)) rows.push({ clip_id: r.clip_id, speaker_group: r.speaker_group, transcript: JSON.parse(await readFile(f, 'utf8')).text });
}
await writeFile(path.join(outDir, 'whisper_transcripts.csv'),
  ['clip_id,speaker_group,transcript', ...rows.map((r) => [r.clip_id, r.speaker_group, r.transcript].map(cell).join(','))].join('\n') + '\n');
await writeFile(path.join(outDir, 'whisper_settings.json'), JSON.stringify(SETTINGS, null, 2) + '\n');
await writeFile(path.join(outDir, 'whisper_failures.csv'),
  ['clip_id,reason', ...failures.map((f) => [f.clip_id, f.reason].map(cell).join(','))].join('\n') + '\n');
console.log(`\nSelected ${selected.length} | new ${fresh} | cached ${cached} | failed ${failures.length} | CSV rows ${rows.length}`);
console.log(`Settings ${JSON.stringify(SETTINGS)}`);
