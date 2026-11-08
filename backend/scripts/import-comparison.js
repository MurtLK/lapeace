// Build data/comparison.whisper.json from the alternative model's transcripts.
//   node scripts/import-comparison.js --transcripts <whisper_transcripts.csv> --settings <whisper_settings.json>
//                                     [--samples data/samples.saa.json] [--out data/comparison.whisper.json]
// Transcripts are stored raw (no normalization). Reports clip IDs missing from the samples and empty text.
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv } from '../src/csv.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const { values: args } = parseArgs({
  options: {
    transcripts: { type: 'string', default: process.env.ALT_TRANSCRIPTS },
    settings: { type: 'string', default: process.env.ALT_SETTINGS },
    samples: { type: 'string', default: path.join(here, '..', 'data', 'samples.saa.json') },
    out: { type: 'string', default: path.join(here, '..', 'data', 'comparison.whisper.json') },
  },
});
if (!args.transcripts || !args.settings) {
  console.error('Usage: node scripts/import-comparison.js --transcripts <csv> --settings <json>');
  process.exit(1);
}
const rows = parseCsv(await readFile(path.resolve(args.transcripts), 'utf8'));
const settings = JSON.parse(await readFile(path.resolve(args.settings), 'utf8'));
const samples = JSON.parse(await readFile(path.resolve(args.samples), 'utf8')).samples;
const ids = new Set(samples.map((s) => s.clip_id));
const unknown = rows.filter((r) => !ids.has(r.clip_id)).map((r) => r.clip_id);
const empty = rows.filter((r) => !r.transcript.trim()).map((r) => r.clip_id);
const counts = rows.reduce((m, r) => ((m[r.speaker_group] = (m[r.speaker_group] || 0) + 1), m), {});

const out = {
  notice: 'Measured on Speech Accent Archive recordings (same audio, reference and scoring for both systems). The live agent does not use the alternative model.',
  generated_at: new Date().toISOString(),
  systems: {
    baseline: { id: 'scribe_v2', label: 'ElevenLabs Scribe v2', runs: 'ElevenLabs cloud API', settings: { language_code: 'en', tag_audio_events: false, keyterms: [] } },
    alternative: { id: 'whisper-large-v3-turbo-q5_0', label: 'Whisper large-v3-turbo (local, whisper.cpp)', runs: 'local Mac (Apple M3)', settings },
  },
  evaluation_set: { rule: 'All Mandarin Chinese, Punjabi and English (Canadian-born) Speech Accent Archive clips, excluding english132 (possible duplicate of english101).', clips_by_group: counts },
  transcripts: rows.filter((r) => ids.has(r.clip_id)).map((r) => ({ clip_id: r.clip_id, text: r.transcript })),
};
// Keep hand-picked featured clips from a previous import.
try {
  const prev = JSON.parse(await readFile(path.resolve(args.out), 'utf8'));
  if (prev.featured_override) out.featured_override = prev.featured_override;
  if (prev.featured_notes) out.featured_notes = prev.featured_notes;
} catch {}
await writeFile(path.resolve(args.out), JSON.stringify(out, null, 2) + '\n');
console.log(`Rows ${rows.length} | written ${out.transcripts.length} | by group ${JSON.stringify(counts)}`);
console.log(`Unknown clip IDs: ${unknown.length} ${unknown.join(', ')} | empty transcripts: ${empty.length} ${empty.join(', ')}`);
if (unknown.length || empty.length) process.exit(2);
