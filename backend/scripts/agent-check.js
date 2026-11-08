// Read-only check of the configured ElevenLabs agent: prints its name, language, first
// message, the start of its prompt, and any tools, so you can confirm it is the simulated
// freeze-card demo with no tools that could reach a real system.
//   npm run agent:check     (uses ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID from backend/.env)
const key = process.env.ELEVENLABS_API_KEY;
const id = process.env.ELEVENLABS_AGENT_ID;
if (!key || !id) {
  console.error('Set ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID in backend/.env first.');
  process.exit(1);
}
const base = (process.env.ELEVENLABS_API_BASE || 'https://api.elevenlabs.io').replace(/\/$/, '');
const res = await fetch(`${base}/v1/convai/agents/${encodeURIComponent(id)}`, { headers: { 'xi-api-key': key } });
if (!res.ok) {
  console.error(`ElevenLabs returned HTTP ${res.status}`);
  process.exit(1);
}
const a = await res.json();
const agent = a.conversation_config?.agent ?? {};
const prompt = agent.prompt ?? {};
const tools = [...(prompt.tools ?? []), ...(prompt.tool_ids ?? []).map((t) => ({ name: t, type: 'tool_id' }))];
console.log(`Name:          ${a.name ?? '(none)'}`);
console.log(`Language:      ${agent.language ?? '(not set)'}`);
console.log(`First message: ${agent.first_message ?? '(none)'}`);
console.log(`Prompt start:  ${(prompt.prompt ?? '(none)').slice(0, 400).replace(/\s+/g, ' ')}`);
console.log(`Tools:         ${tools.length ? tools.map((t) => `${t.name} [${t.type}]`).join(', ') : 'none'}`);
const risky = tools.filter((t) => ['webhook', 'tool_id', 'mcp', 'client'].includes(t.type));
if (risky.length) console.log('CHECK: the tools above can call outside systems. The demo should have no webhook/MCP tools.');
