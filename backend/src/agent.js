// Live ElevenLabs agent: mints a short-lived connection credential for a PRIVATE agent.
// The API key never leaves the server; the browser only receives the credential.
//
//   ELEVENLABS_API_KEY   server-side secret (backend/.env, gitignored)
//   ELEVENLABS_AGENT_ID  the demo agent (agent_...)
//   AGENT_CONNECTION     webrtc (default, voice) | websocket
//   ELEVENLABS_API_BASE  optional, default https://api.elevenlabs.io (data-residency or tests)
//
// Docs: https://elevenlabs.io/docs/eleven-agents/api-reference/conversations/get-webrtc-token
//       https://elevenlabs.io/docs/agents-platform/customization/authentication

const API_BASE = (process.env.ELEVENLABS_API_BASE || 'https://api.elevenlabs.io').replace(/\/$/, '');
export const CONNECTION = (process.env.AGENT_CONNECTION || 'webrtc').toLowerCase();

export function agentConfigStatus() {
  const missing = ['ELEVENLABS_API_KEY', 'ELEVENLABS_AGENT_ID'].filter((k) => !process.env[k]);
  if (!['webrtc', 'websocket'].includes(CONNECTION)) missing.push('AGENT_CONNECTION (must be webrtc or websocket)');
  return { ready: missing.length === 0, missing, connection: CONNECTION };
}

// Small per-IP limit so a public page can't burn the team's agent credits.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const hits = new Map();
export function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

export async function createSession() {
  const agentId = encodeURIComponent(process.env.ELEVENLABS_AGENT_ID);
  const url = CONNECTION === 'webrtc'
    ? `${API_BASE}/v1/convai/conversation/token?agent_id=${agentId}`
    : `${API_BASE}/v1/convai/conversation/get-signed-url?agent_id=${agentId}`;
  const res = await fetch(url, { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY } });
  if (!res.ok) {
    const err = new Error(`ElevenLabs returned HTTP ${res.status}`);
    err.upstreamStatus = res.status;
    throw err;
  }
  const body = await res.json();
  // Return ONLY the credential the client SDK needs.
  if (CONNECTION === 'webrtc') {
    if (typeof body.token !== 'string') throw new Error('ElevenLabs response had no token');
    return { connection_type: 'webrtc', conversation_token: body.token };
  }
  if (typeof body.signed_url !== 'string') throw new Error('ElevenLabs response had no signed_url');
  return { connection_type: 'websocket', signed_url: body.signed_url };
}
