import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadSamples, toApiSample, validateConfig, AUDIO_DIR, SAMPLES_FILE, USING_FIXTURE } from './samples.js';
import { summarizeGroups, HIGH_WER_THRESHOLD, FILLERS } from './groups.js';
import { agentConfigStatus, createSession, rateLimited } from './agent.js';
import { loadComparison, buildComparison, COMPARISON_FILE } from './comparison.js';
import { alignWords } from './wer.js';
import { handleCallcheck, callcheckLimited } from './callcheck.js';

const PORT = Number(process.env.PORT) || 8787;
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
// Origins allowed to mint agent sessions: the backend's own pages plus CORS_ORIGIN (comma-separated).
// Read-only routes stay open to any origin; the credential endpoint does not.
const AGENT_ORIGINS = new Set([
  PUBLIC_BASE_URL,
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`,
  ...(process.env.CORS_ORIGIN || '').split(',').map((o) => o.trim()).filter((o) => o && o !== '*'),
]);
const AUDIO_TYPES ={ '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac' };

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body, null, 2));
}

const audioUrl = (file) => `${PUBLIC_BASE_URL}/audio/${encodeURIComponent(file)}`;

// Section 1 default clip: FEATURED_CLIP_ID if valid, else the worst-scoring Mandarin/Punjabi clip.
function featuredClipId(samples) {
  const wanted = process.env.FEATURED_CLIP_ID;
  if (wanted && samples.some((s) => s.clip_id === wanted)) return wanted;
  const pool = samples.filter((s) => typeof s.wer === 'number' && ['Mandarin Chinese', 'Punjabi'].includes(s.speaker_group));
  return (pool.sort((a, b) => b.wer - a.wer)[0] || samples[0])?.clip_id ?? null;
}

async function handleSamples(req, res, query) {
  const data = await loadSamples();
  // Never derive URLs from the request's Host header (spoofable); use configured base only.
  let samples = data.samples;
  const clipId = query.get('clip_id');
  if (clipId) samples = samples.filter((s) => s.clip_id === clipId);
  const diff = query.get('diff') === '1';
  sendJson(res, 200, {
    source: data.source,
    notice: data.notice,
    featured_clip_id: featuredClipId(data.samples),
    samples: samples.map((s) => {
      const out = toApiSample(s, PUBLIC_BASE_URL);
      if (diff) out.scribe_ops = alignWords(s.reference_transcript, s.scribe_transcript).ops;
      return out;
    }),
  });
}

async function handleComparison(req, res, query) {
  const cmp = await loadComparison();
  if (!cmp) return sendJson(res, 404, { error: 'comparison_not_available' });
  const data = await loadSamples();
  sendJson(res, 200, buildComparison(data.samples, cmp, audioUrl, {
    includeOps: query.get('ops') !== '0',
    clipId: query.get('clip_id'),
  }));
}

async function handleGroups(req, res) {
  const data = await loadSamples();
  sendJson(res, 200, {
    source: data.source,
    notice: data.notice,
    wer_unit: 'fraction (0.05 = 5% of reference words wrong)',
    high_wer_threshold: HIGH_WER_THRESHOLD,
    definitions: {
      mean_wer: 'mean of per-clip WER in the group',
      median_wer: 'median of per-clip WER in the group',
      clips_above_threshold: `clips in the group with WER > ${HIGH_WER_THRESHOLD}`,
      share_above_threshold: 'clips_above_threshold / clips (denominator = all clips in the group)',
      filler_sensitivity: `same statistics after removing spoken fillers (${FILLERS.join(', ')}) from the Scribe transcript; sensitivity analysis only, not the primary metric`,
    },
    groups: summarizeGroups(data.samples),
  });
}

async function handleAgentSession(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const status = agentConfigStatus();
  if (!status.ready) {
    return sendJson(res, 503, { error: 'agent_not_configured', missing: status.missing });
  }
  // Behind the Cloudflare tunnel every request arrives from loopback, so per-IP limiting needs the
  // visitor IP header. Only trust it when explicitly enabled (it is spoofable on a direct connection).
  const ip = (process.env.TRUST_CF_CONNECTING_IP === '1' && req.headers['cf-connecting-ip']) || req.socket.remoteAddress || 'unknown';
  if (rateLimited(ip)) {
    return sendJson(res, 429, { error: 'too_many_sessions', retry_after_sec: 60 });
  }
  try {
    sendJson(res, 200, await createSession());
  } catch (err) {
    console.error(`Agent session failed: ${err.message}`); // never includes the API key
    sendJson(res, 502, { error: 'agent_session_failed', upstream_status: err.upstreamStatus ?? null });
  }
}

// Small precomputed evidence files (built by scripts/build-census.js, build_audit.py, test-311.js).
const DATA_DIR = new URL('../data/', import.meta.url);
const EVIDENCE = { '/api/census': 'census.json', '/api/audit': 'audit.json', '/api/clarify311': 'clarify311.json', '/api/scamcheck': 'scamcheck.json' };
const CLARIFY_AUDIO_DIR = process.env.CLARIFY_AUDIO_DIR ? path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', process.env.CLARIFY_AUDIO_DIR) : null;
async function handleEvidence(res, file) {
  try {
    sendJson(res, 200, JSON.parse(await readFile(new URL(file, DATA_DIR), 'utf8')));
  } catch {
    sendJson(res, 404, { error: 'not_available', file });
  }
}

async function handleAudio(req, res, rawName, dir = AUDIO_DIR) {
  const name = decodeURIComponent(rawName);
  const type = AUDIO_TYPES[path.extname(name).toLowerCase()];
  // Only plain file names inside AUDIO_DIR (no slashes, no "..").
  if (!/^[\w.-]+$/.test(name) || name.includes('..') || !type) {
    return sendJson(res, 400, { error: 'invalid audio file name' });
  }
  const file = path.join(dir, name);
  let info;
  try {
    info = await stat(file);
  } catch {
    return sendJson(res, 404, { error: 'audio not found' });
  }

  // Range support so browsers can seek in <audio>.
  const range = req.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : info.size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : info.size - 1;
    start = Math.max(0, start);
    end = Math.min(end, info.size - 1);
    if (start > end) {
      res.writeHead(416, { 'Content-Range': `bytes */${info.size}` });
      return res.end();
    }
    res.writeHead(206, {
      'Content-Type': type,
      'Content-Length': end - start + 1,
      'Content-Range': `bytes ${start}-${end}/${info.size}`,
      'Accept-Ranges': 'bytes',
    });
    return createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': info.size, 'Accept-Ranges': 'bytes' });
  createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const { pathname, searchParams: query } = new URL(req.url, 'http://localhost');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
  if (pathname !== '/api/agent/session') {
    // Read-only public data: any origin may read it.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }
  } else {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  }

  try {
    if (pathname === '/api/agent/session') {
      // Browsers always send Origin on POST. Only allowlisted origins may mint credentials,
      // and they get their own origin echoed back instead of '*'.
      const origin = req.headers.origin;
      if (!origin || !AGENT_ORIGINS.has(origin)) {
        return sendJson(res, 403, { error: 'origin_not_allowed', hint: 'add the UI origin to CORS_ORIGIN in backend/.env' });
      }
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'use POST' });
      return await handleAgentSession(req, res);
    }
    if (pathname === '/api/callcheck') {
      // Same-site only: the live check spends API credits.
      const origin = req.headers.origin;
      if (!origin || !AGENT_ORIGINS.has(origin)) return sendJson(res, 403, { error: 'origin_not_allowed' });
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'use POST' });
      const ip = (process.env.TRUST_CF_CONNECTING_IP === '1' && req.headers['cf-connecting-ip']) || req.socket.remoteAddress || 'unknown';
      if (callcheckLimited(ip)) return sendJson(res, 429, { error: 'too_many_checks', retry_after_sec: 60 });
      return await handleCallcheck(req, res, sendJson);
    }
    if (pathname === '/call-check') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return createReadStream(new URL('../public/call-check.html', import.meta.url)).pipe(res);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendJson(res, 405, { error: 'method not allowed' });
    }
    if (pathname === '/api/samples') return await handleSamples(req, res, query);
    if (pathname === '/api/groups') return await handleGroups(req, res);
    if (pathname === '/api/comparison') return await handleComparison(req, res, query);
    if (EVIDENCE[pathname]) return await handleEvidence(res, EVIDENCE[pathname]);
    const a311 = pathname.match(/^\/audio311\/([^/]+)$/);
    if (a311) return CLARIFY_AUDIO_DIR ? await handleAudio(req, res, a311[1], CLARIFY_AUDIO_DIR) : sendJson(res, 404, { error: 'not_available' });
    if (pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return createReadStream(new URL('../public/index.html', import.meta.url)).pipe(res);
    }
    if (pathname === '/dev/agent-test') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return createReadStream(new URL('../public/agent-test.html', import.meta.url)).pipe(res);
    }
    const audio = pathname.match(/^\/audio\/([^/]+)$/);
    if (audio) return await handleAudio(req, res, audio[1]);
    sendJson(res, 404, { error: 'not found' });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) sendJson(res, 500, { error: 'internal error' });
    else res.end();
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Start with another port, e.g. PORT=8788 npm start`);
    process.exit(1);
  }
  throw err;
});

let loaded;
try {
  loaded = await validateConfig();
  const cmp = await loadComparison().catch((err) => { throw new Error(`COMPARISON_FILE unreadable: ${COMPARISON_FILE} (${err.message})`); });
  if (cmp) {
    const ids = new Set((await loadSamples()).samples.map((s) => s.clip_id));
    const missing = cmp.transcripts.filter((t) => !ids.has(t.clip_id)).map((t) => t.clip_id);
    if (missing.length) throw new Error(`COMPARISON_FILE has clip IDs not in SAMPLES_FILE, e.g. ${missing.slice(0, 3).join(', ')}`);
    for (const id of Object.values(cmp.featured_override || {})) if (id && !ids.has(id)) throw new Error(`featured_override clip not found: ${id}`);
    loaded.comparison = `${cmp.transcripts.length} clips (alternative=${cmp.systems?.alternative?.id})`;
  }
} catch (err) {
  console.error(`Config error: ${err.message}`);
  process.exit(1);
}

server.listen(PORT, () => {
  console.log(`LAPEACE backend on http://localhost:${PORT} (pid ${process.pid})`);
  console.log(`Samples: ${loaded.count} from ${SAMPLES_FILE} [source=${loaded.source}]`);
  console.log(`Audio:   ${AUDIO_DIR}`);
  if (USING_FIXTURE) console.warn('WARNING: serving FIXTURE data. Set SAMPLES_FILE and AUDIO_DIR in backend/.env for real data.');
  const agent = agentConfigStatus();
  console.log(agent.ready
    ? `Agent:   ready (${agent.connection})`
    : `Agent:   NOT configured, /api/agent/session returns 503. Missing: ${agent.missing.join(', ')}`);
  console.log(`Compare: ${loaded.comparison || 'not configured (set COMPARISON_FILE); /api/comparison returns 404'}`);
});
