// Transcribe FLEURS home-language clips with ElevenLabs Scribe v2, each in its own spoken language.
//   node run.js --dataset <02_speech_home_languages_FLEURS> --select           # write the pilot selection (no API calls)
//   node run.js --dataset <...> --selection pilot --max-requests N               # transcribe the saved selection
//   node run.js --dataset <...> --selection all                                  # every clip
//   add --langs pt_br,pa_in to restrict; --autodetect for the SEPARATE auto-detect retry (own cache dir)
// API key: ELEVENLABS_API_KEY env only, never logged or saved. Responses are cached per clip + settings.
// The reference transcript is never sent. keyterms empty, tag_audio_events=false (same as the SAA baseline).
import { readFile, writeFile, mkdir, access, appendFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const API_URL = 'https://api.elevenlabs.io/v1/speech-to-text';
// FLEURS config -> language code sent to Scribe (ISO 639-3, per ElevenLabs' supported-language list).
export const LANG_CODES = {
  en_us: 'eng', ur_pk: 'urd', ar_eg: 'ara', cmn_hans_cn: 'zho', pa_in: 'pan', pl_pl: 'pol', yue_hant_hk: 'yue',
  fil_ph: 'fil', es_419: 'spa', ta_in: 'tam', vi_vn: 'vie', hi_in: 'hin', pt_br: 'por', gu_in: 'guj',
};
const { values: args } = parseArgs({ options: {
  dataset: { type: 'string' }, out: { type: 'string', default: path.join(here, '..', '..', 'results', 'scribe_fleurs') },
  select: { type: 'boolean', default: false }, selection: { type: 'string' }, langs: { type: 'string' },
  'per-lang': { type: 'string', default: '4' }, concurrency: { type: 'string', default: '4' },
  'max-requests': { type: 'string' }, autodetect: { type: 'boolean', default: false },
} });
const fail = (m) => { console.error(`Error: ${m}`); process.exit(1); };
const exists = (p) => access(p).then(() => true, () => false);

export function parseCsv(text) {
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') q = false; else field += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); field = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = []; }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [h, ...b] = rows; return b.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ''])));
}

if (!args.dataset) fail('--dataset is required');
const dataset = path.resolve(args.dataset);
const meta = parseCsv(await readFile(path.join(dataset, 'metadata.csv'), 'utf8'))
  .map((m) => ({ ...m, clip_id: path.basename(m.file, path.extname(m.file)) }));
const out = path.resolve(args.out); await mkdir(out, { recursive: true });

if (args.select) {
  // Pilot: the same N sentence IDs in every language, chosen by a fixed hash of the ID (no transcripts seen).
  const n = Number(args['per-lang']);
  const ids = [...new Set(meta.map((m) => m.fleurs_id))]
    .sort((a, b) => createHash('sha256').update('lapeace-fleurs-pilot|' + a).digest('hex').localeCompare(createHash('sha256').update('lapeace-fleurs-pilot|' + b).digest('hex')))
    .slice(0, n).sort();
  const sel = meta.filter((m) => ids.includes(m.fleurs_id)).map((m) => m.clip_id);
  await writeFile(path.join(out, 'selection_pilot.json'), JSON.stringify({ method: `first ${n} fleurs_id by sha256("lapeace-fleurs-pilot|"+id), same IDs in every language; chosen before any transcription`, fleurs_ids: ids, clips: sel, created_at: new Date().toISOString() }, null, 2) + '\n');
  console.log(`pilot selection: ${ids.join(', ')} -> ${sel.length} clips`); process.exit(0);
}

let clips;
if (args.selection === 'all') clips = meta;
else if (args.selection) { const s = JSON.parse(await readFile(path.join(out, `selection_${args.selection}.json`), 'utf8')); clips = meta.filter((m) => s.clips.includes(m.clip_id)); }
else fail('--select or --selection <pilot|all>');
if (args.langs) { const L = args.langs.split(','); clips = clips.filter((m) => L.includes(m.lang_config)); }

const key = process.env.ELEVENLABS_API_KEY?.trim();
const maxReq = args['max-requests'] ? Number(args['max-requests']) : Infinity;
const cacheDir = path.join(out, args.autodetect ? 'cache_autodetect' : 'cache'); await mkdir(cacheDir, { recursive: true });
const failLog = path.join(out, args.autodetect ? 'failures_autodetect.jsonl' : 'failures.jsonl');
let live = 0, cached = 0, failed = 0, stop = null;

function settingsFor(m) {
  return { model_id: 'scribe_v2', language_code: args.autodetect ? null : LANG_CODES[m.lang_config], tag_audio_events: false, keyterms: [] };
}
async function one(m) {
  const settings = settingsFor(m);
  const h = createHash('sha256').update(JSON.stringify(settings)).digest('hex').slice(0, 10);
  const cache = path.join(cacheDir, `${m.clip_id}.${h}.json`);
  if (await exists(cache)) { cached++; return; }
  if (stop) return;
  if (live >= maxReq) { stop = stop || 'max-requests reached'; return; }
  if (!key) { stop = 'ELEVENLABS_API_KEY not set'; return; }
  live++;
  const form = new FormData();
  form.append('model_id', settings.model_id);
  if (settings.language_code) form.append('language_code', settings.language_code);
  form.append('tag_audio_events', 'false');
  form.append('file', new Blob([await readFile(path.join(dataset, m.file))], { type: 'audio/flac' }), path.basename(m.file));
  try {
    const res = await fetch(API_URL, { method: 'POST', headers: { 'xi-api-key': key }, body: form });
    const body = await res.text();
    if (!res.ok) {
      failed++;
      await appendFile(failLog, JSON.stringify({ clip_id: m.clip_id, lang: m.lang_config, sent_language_code: settings.language_code, http: res.status, body: body.slice(0, 400), at: new Date().toISOString() }) + '\n');
      if ([401, 402, 403, 429].includes(res.status) && /quota|credit|permission|limit|unauthor/i.test(body)) stop = `HTTP ${res.status}: ${body.slice(0, 160)}`;
      return;
    }
    const json = JSON.parse(body);
    await writeFile(cache, JSON.stringify({ clip_id: m.clip_id, settings, received_at: new Date().toISOString(), response: json }, null, 2));
  } catch (e) { failed++; await appendFile(failLog, JSON.stringify({ clip_id: m.clip_id, error: String(e).slice(0, 300) }) + '\n'); }
}
const queue = [...clips];
await Promise.all(Array.from({ length: Number(args.concurrency) }, async () => { while (queue.length && !stop) await one(queue.shift()); }));
console.log(JSON.stringify({ selected: clips.length, live_requests: live, cached, failed, stopped: stop }));
