// POST /api/callcheck: body = 16 kHz mono WAV from the browser mic (or a demo clip).
// Scribe v2 transcribes it (real API call), the red-flag rules check what was asked, and the
// optional voice detector (prototype) scores whether the audio sounds synthetic.
// Audio is held in memory only; nothing is saved. The API key is never logged or returned.
import { execFile } from 'node:child_process';
import { writeFile, rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { check } from './scamrules.js';

export const MAX_BYTES = 700_000; // ~21 s of 16 kHz mono 16-bit WAV
const WINDOW_MS = 60_000, PER_IP = 12, GLOBAL = 40, MAX_TRACKED = 1000;
const hits = new Map(); let globalHits = [];
export function callcheckLimited(ip) {
  const now = Date.now();
  globalHits = globalHits.filter((t) => now - t < WINDOW_MS);
  if (globalHits.length >= GLOBAL) return true;
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= PER_IP) return true;
  recent.push(now); globalHits.push(now);
  hits.delete(ip); hits.set(ip, recent);
  while (hits.size > MAX_TRACKED) hits.delete(hits.keys().next().value);
  return false;
}

export function readBody(req, limit = MAX_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(Object.assign(new Error('too_large'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Accept only 16-bit mono PCM WAV at 8-48 kHz; walk the chunks instead of assuming offsets.
function wavOk(b) {
  if (!(b.length > 44 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WAVE')) return false;
  let o = 12;
  while (o + 8 <= b.length) {
    const id = b.toString('ascii', o, o + 4), sz = b.readUInt32LE(o + 4);
    if (id === 'fmt ') {
      if (sz < 16 || o + 24 > b.length) return false;
      const format = b.readUInt16LE(o + 8), ch = b.readUInt16LE(o + 10), rate = b.readUInt32LE(o + 12), bits = b.readUInt16LE(o + 22);
      return format === 1 && ch === 1 && bits === 16 && rate >= 8000 && rate <= 48000;
    }
    o += 8 + sz + (sz & 1);
  }
  return false;
}
let detectorsRunning = 0; const MAX_DETECTORS = 2;

async function scribe(wav) {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) throw Object.assign(new Error('not_configured'), { status: 503 });
  const form = new FormData();
  form.append('model_id', 'scribe_v2'); form.append('tag_audio_events', 'false');
  if (process.env.CALLCHECK_LANGUAGE) form.append('language_code', process.env.CALLCHECK_LANGUAGE);
  form.append('file', new Blob([wav], { type: 'audio/wav' }), 'call.wav');
  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': key }, body: form });
  if (!res.ok) throw Object.assign(new Error('scribe_failed'), { status: 502, upstream: res.status });
  const j = await res.json();
  return { text: (j.text || '').trim(), language_code: j.language_code, language_probability: j.language_probability };
}

// Optional prototype voice detector: VOICE_DETECTOR=<python> <script> <model> (set in env).
async function voiceCheck(wav) {
  const py = process.env.VOICE_DETECTOR_PYTHON, script = process.env.VOICE_DETECTOR_SCRIPT, model = process.env.VOICE_DETECTOR_MODEL;
  if (!py || !script || !model) return null;
  if (detectorsRunning >= MAX_DETECTORS) return { error: 'voice_check_busy' };
  detectorsRunning++;
  let dir;
  try {
    dir = await mkdtemp(path.join(tmpdir(), 'callcheck-'));
    const file = path.join(dir, 'call.wav');
    await writeFile(file, wav);
    const out = await new Promise((resolve, reject) => execFile(py, ['-I', script, 'predict', model, file], { timeout: 15000, killSignal: 'SIGKILL', maxBuffer: 64 * 1024 }, (e, so) => (e ? reject(e) : resolve(so))));
    return JSON.parse(out);
  } catch (e) {
    console.error(`voice check failed: ${e.message.slice(0, 120)}`);
    return { error: 'voice_check_failed' };
  } finally { detectorsRunning--; if (dir) await rm(dir, { recursive: true, force: true }); }
}

export async function handleCallcheck(req, res, sendJson) {
  let wav;
  try { wav = await readBody(req); } catch (e) { return sendJson(res, e.status || 400, { error: e.status === 413 ? 'too_large' : 'bad_request' }); }
  if (!wavOk(wav)) return sendJson(res, 400, { error: 'send 16-bit mono PCM WAV at 8-48 kHz' });
  try {
    const [heard, voice] = await Promise.all([scribe(wav), voiceCheck(wav)]);
    return sendJson(res, 200, { transcript: heard.text, language_code: heard.language_code, ...check(heard.text), voice_check: voice,
      notice: 'Live check: Scribe v2 transcription + fixed red-flag rules. The voice check is a prototype; see the page for its tested accuracy.' });
  } catch (e) {
    console.error(`call check failed: ${e.message}${e.upstream ? ` (upstream ${e.upstream})` : ''}`);
    const known = new Set(['not_configured', 'scribe_failed']);
    return sendJson(res, e.status || 500, { error: known.has(e.message) ? e.message : 'call_check_failed' });
  }
}
