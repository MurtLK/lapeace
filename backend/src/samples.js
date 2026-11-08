// Loads sample records.
//   SAMPLES_FILE  JSON file with { source, notice, samples[] } (e.g. data/samples.saa.json)
//   AUDIO_DIR     folder holding the files named by each sample's audio_file
// Neither set -> the bundled FIXTURE (one clip) for local UI work.
// Either set but invalid -> validateConfig() throws and the server refuses to start.
import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_FILE = path.join(here, '..', 'data', 'samples.fixture.json');
const FIXTURE_AUDIO = path.join(here, '..', 'fixtures', 'audio');
const backendRoot = path.join(here, '..');

// Relative paths in config are resolved from backend/, so .env works from any cwd.
const resolve = (p) => path.resolve(backendRoot, p);

export const SAMPLES_FILE = process.env.SAMPLES_FILE ? resolve(process.env.SAMPLES_FILE) : FIXTURE_FILE;
export const AUDIO_DIR = process.env.AUDIO_DIR ? resolve(process.env.AUDIO_DIR) : FIXTURE_AUDIO;
export const USING_FIXTURE = !process.env.SAMPLES_FILE && !process.env.AUDIO_DIR;

let cache = null;

export async function loadSamples() {
  if (!cache) cache = JSON.parse(await readFile(SAMPLES_FILE, 'utf8'));
  return cache;
}

export async function validateConfig() {
  if (!USING_FIXTURE && (!process.env.SAMPLES_FILE || !process.env.AUDIO_DIR)) {
    throw new Error('Set BOTH SAMPLES_FILE and AUDIO_DIR (or neither, to use the fixture).');
  }
  try {
    if (!(await stat(AUDIO_DIR)).isDirectory()) throw new Error();
  } catch {
    throw new Error(`AUDIO_DIR is not a readable folder: ${AUDIO_DIR}`);
  }
  let data;
  try {
    data = await loadSamples();
  } catch (err) {
    throw new Error(`SAMPLES_FILE could not be read as JSON: ${SAMPLES_FILE} (${err.message})`);
  }
  if (!Array.isArray(data.samples) || data.samples.length === 0) {
    throw new Error(`SAMPLES_FILE has no samples[]: ${SAMPLES_FILE}`);
  }
  const onDisk = new Set(await readdir(AUDIO_DIR));
  const missing = data.samples.filter((s) => !onDisk.has(s.audio_file)).map((s) => s.audio_file);
  if (missing.length) {
    throw new Error(`${missing.length} audio files listed in SAMPLES_FILE are not in AUDIO_DIR, e.g. ${missing.slice(0, 3).join(', ')}`);
  }
  return { source: data.source, count: data.samples.length };
}

// Turn the stored record into the API shape: audio_file -> absolute audio_url.
export function toApiSample(record, baseUrl) {
  const { audio_file, ...rest } = record;
  return { ...rest, audio_url: `${baseUrl}/audio/${encodeURIComponent(audio_file)}` };
}
