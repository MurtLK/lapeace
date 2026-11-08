import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { loadSamples, toApiSample, validateConfig, AUDIO_DIR, SAMPLES_FILE, USING_FIXTURE } from './samples.js';
import { summarizeGroups, HIGH_WER_THRESHOLD, FILLERS } from './groups.js';
import { agentConfigStatus, createSession, rateLimited } from './agent.js';

const PORT = Number(process.env.PORT) || 8787;
const AUDIO_TYPES = { '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac' };

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body, null, 2));
}

async function handleSamples(req, res) {
  const data = await loadSamples();
  const baseUrl = process.env.PUBLIC_BASE_URL || `http://${req.headers.host}`;
  sendJson(res, 200, {
    source: data.source,
    notice: data.notice,
    samples: data.samples.map((s) => toApiSample(s, baseUrl)),
  });
}

async function handleGroups(req, res) {
  const data = await loadSamples();
  sendJson(res, 200, {
    source: data.source,
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
  if (rateLimited(req.socket.remoteAddress || 'unknown')) {
    return sendJson(res, 429, { error: 'too_many_sessions', retry_after_sec: 60 });
  }
  try {
    sendJson(res, 200, await createSession());
  } catch (err) {
    console.error(`Agent session failed: ${err.message}`); // never includes the API key
    sendJson(res, 502, { error: 'agent_session_failed', upstream_status: err.upstreamStatus ?? null });
  }
}

async function handleAudio(req, res, rawName) {
  const name = decodeURIComponent(rawName);
  const type = AUDIO_TYPES[path.extname(name).toLowerCase()];
  // Only plain file names inside AUDIO_DIR (no slashes, no "..").
  if (!/^[\w.-]+$/.test(name) || name.includes('..') || !type) {
    return sendJson(res, 400, { error: 'invalid audio file name' });
  }
  const file = path.join(AUDIO_DIR, name);
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
  // Allow the UI dev server (different port/origin) to call the API.
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const { pathname } = new URL(req.url, 'http://localhost');
  try {
    if (pathname === '/api/agent/session') {
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'use POST' });
      return await handleAgentSession(req, res);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendJson(res, 405, { error: 'method not allowed' });
    }
    if (pathname === '/api/samples') return await handleSamples(req, res);
    if (pathname === '/api/groups') return await handleGroups(req, res);
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
});
