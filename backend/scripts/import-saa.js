// Build the samples JSON for the backend from Scribe results + Speech Accent Archive metadata.
//
//   node scripts/import-saa.js --transcripts <transcripts.csv> --dataset <SAA folder> [--out data/samples.saa.json]
//
// <SAA folder> is the folder that holds metadata.csv and audio/. Every clip_id is matched to
// metadata.csv's `file` column and the file is checked on disk. Unmatched rows/files are
// reported; the command exits non-zero if any transcript row has no audio.
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv } from '../src/csv.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const { values: args } = parseArgs({
  options: {
    transcripts: { type: 'string', default: process.env.SAA_TRANSCRIPTS },
    dataset: { type: 'string', default: process.env.SAA_DATASET },
    out: { type: 'string', default: path.join(here, '..', 'data', 'samples.saa.json') },
  },
});
if (!args.transcripts || !args.dataset) {
  console.error('Usage: node scripts/import-saa.js --transcripts <transcripts.csv> --dataset <SAA folder> [--out file]');
  process.exit(1);
}

const num = (v) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const str = (v) => (v === undefined || v.trim() === '' ? null : v.trim());

const dataset = path.resolve(args.dataset);
const transcripts = parseCsv(await readFile(path.resolve(args.transcripts), 'utf8'));
const metadata = parseCsv(await readFile(path.join(dataset, 'metadata.csv'), 'utf8'));
const metaById = new Map(metadata.map((m) => [path.basename(m.file, path.extname(m.file)), m]));
const audioOnDisk = new Set(await readdir(path.join(dataset, 'audio')));

const samples = [];
const problems = { no_metadata: [], audio_missing: [], group_mismatch: [] };
for (const t of transcripts) {
  const m = metaById.get(t.clip_id);
  if (!m) { problems.no_metadata.push(t.clip_id); continue; }
  const audioFile = path.basename(m.file);
  if (!audioOnDisk.has(audioFile)) { problems.audio_missing.push(`${t.clip_id} -> ${audioFile}`); continue; }
  if (m.language !== t.speaker_group) problems.group_mismatch.push(`${t.clip_id}: ${t.speaker_group} vs ${m.language}`);
  samples.push({
    clip_id: t.clip_id,
    dataset: 'speech_accent_archive',
    audio_file: audioFile,
    duration_sec: num(m.duration_sec),
    reference_transcript: t.reference,
    scribe_transcript: t.raw_transcript, // raw Scribe output, punctuation preserved
    scribe_transcript_is_simulated: false,
    wer: num(t.wer), // fraction 0..1 (0.05 = 5% of reference words wrong); can exceed 1
    speaker_group: m.language,
    speaker: {
      first_language: str(m.native_language),
      gender: str(m.gender),
      age: num(m.age),
      birth_country: str(m.birth_country),
      english_onset_age: num(m.english_onset_age),
    },
  });
}

const transcribed = new Set(transcripts.map((t) => t.clip_id));
const filesWithoutTranscript = [...audioOnDisk].filter(
  (f) => !transcribed.has(path.basename(f, path.extname(f))),
);

const model = transcripts[0]?.model_id || 'unknown';
const out = {
  source: 'speech_accent_archive_scribe',
  notice: `Real ElevenLabs Scribe (${model}) transcripts of Speech Accent Archive recordings. wer is a fraction (0.05 = 5%).`,
  generated_at: new Date().toISOString(),
  samples,
};
await mkdir(path.dirname(path.resolve(args.out)), { recursive: true });
await writeFile(path.resolve(args.out), JSON.stringify(out, null, 2) + '\n');

console.log(`Transcript rows: ${transcripts.length} | metadata rows: ${metadata.length} | audio files on disk: ${audioOnDisk.size}`);
console.log(`Wrote ${samples.length} samples -> ${path.resolve(args.out)}`);
console.log(`Rows with no metadata match: ${problems.no_metadata.length} ${problems.no_metadata.slice(0, 5).join(', ')}`);
console.log(`Rows whose audio file is missing: ${problems.audio_missing.length} ${problems.audio_missing.slice(0, 5).join(', ')}`);
console.log(`Rows whose group disagrees with metadata: ${problems.group_mismatch.length} ${problems.group_mismatch.slice(0, 5).join(', ')}`);
console.log(`Audio files with no transcript row: ${filesWithoutTranscript.length} ${filesWithoutTranscript.slice(0, 5).join(', ')}`);
if (problems.no_metadata.length || problems.audio_missing.length) process.exit(2);
