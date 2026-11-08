// Scam-call check with scripted calls (SIMULATION; known intended labels).
//   ELEVENLABS_API_KEY=... node scripts/test-scam.js --work <audio + cache dir> [--out data/scamcheck.json]
// Each scripted call is spoken by a macOS synthetic voice (`say`), transcribed by ElevenLabs Scribe v2
// (real API call, cached), and checked by the fixed red-flag rules below. Tested: speech -> Scribe -> rules.
// Scripted: the call wording, voices, and the intended label. This does NOT detect whether a voice is AI.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const { values: args } = parseArgs({ options: { work: { type: 'string' }, out: { type: 'string', default: path.join(here, '..', 'data', 'scamcheck.json') } } });
if (!args.work) { console.error('Usage: node scripts/test-scam.js --work <dir>'); process.exit(1); }

// Red flags drawn from common Canadian phone-scam patterns. weight 3 = never legitimate on its own.
export const FLAGS = [
  { id: 'asks_for_code', label: 'Asks for a code, PIN or password', weight: 3, keys: ['code', 'pin', 'password', 'verification'] },
  { id: 'unusual_payment', label: 'Wants gift cards, crypto or a wire transfer', weight: 3, keys: ['gift card', 'gift cards', 'bitcoin', 'crypto', 'wire', 'cryptocurrency'] },
  { id: 'remote_access', label: 'Asks you to install an app or give remote access', weight: 3, keys: ['install', 'remote', 'anydesk', 'download'] },
  { id: 'threat', label: 'Threatens arrest, fines or a frozen account', weight: 2, keys: ['arrest', 'warrant', 'police', 'frozen', 'suspended', 'lawsuit'] },
  { id: 'urgency', label: 'Pressures you to act right now', weight: 1, keys: ['immediately', 'right now', 'today', 'within the hour', 'urgent'] },
  { id: 'secrecy', label: 'Tells you to keep it secret or stay on the line', weight: 2, keys: ["don't tell", 'do not tell', "don't hang up", 'do not hang up', 'keep this between'] },
  { id: 'authority', label: 'Claims to be a government agency or your bank’s fraud team', weight: 1, keys: ['revenue agency', 'government', 'fraud department', 'fraud team'] },
];
export function check(text) {
  const t = ` ${text.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ')} `;
  const found = FLAGS.filter((f) => f.keys.some((k) => t.includes(` ${k} `)));
  const score = found.reduce((a, f) => a + f.weight, 0);
  const verdict = score >= 3 ? 'likely_scam' : score >= 1 ? 'be_careful' : 'no_red_flags';
  return { flags: found.map((f) => f.id), score, verdict };
}
const VERDICT = {
  likely_scam: 'Likely scam: hang up, and call back using the number on your card or the official website.',
  be_careful: 'Be careful: don’t share anything; verify by calling back on an official number.',
  no_red_flags: 'No red flags found. Still, never share codes or passwords on a call you didn’t make.',
};
const CASES = [
  { id: 's1', voice: 'Daniel', voice_accent: 'en-GB', intended: 'scam', kind: 'Fake tax agency',
    script: 'This is the Canada Revenue Agency. You owe back taxes, and a warrant will be issued for your arrest today unless you pay immediately with gift cards. Do not hang up.' },
  { id: 's2', voice: 'Rishi', voice_accent: 'en-IN', intended: 'scam', kind: 'Fake bank fraud team',
    script: "Hi, this is your bank's fraud department. Your card has been frozen. To unlock it, please read me the six digit verification code we just texted you." },
  { id: 's3', voice: 'Moira', voice_accent: 'en-IE', intended: 'scam', kind: 'Family emergency',
    script: "Grandma, it's me. I'm in trouble and I need you to send money by bitcoin right now. Please don't tell Mom." },
  { id: 's4', voice: 'Rishi', voice_accent: 'en-IN', intended: 'legitimate', kind: 'Pharmacy reminder',
    script: 'Hello, this is your pharmacy calling to let you know your prescription is ready for pickup. We are open until nine tonight.' },
  { id: 's5', voice: 'Moira', voice_accent: 'en-IE', intended: 'legitimate', kind: 'Dental appointment',
    script: 'Hi, this is a reminder from your dental clinic about your appointment on Thursday at three. Please call us if you need to reschedule.' },
];

const work = path.resolve(args.work); await mkdir(work, { recursive: true });
const exists = (p) => access(p).then(() => true, () => false);
let apiCalls = 0, cachedCalls = 0;
async function speakAndTranscribe(c) {
  const base = path.join(work, `scam_${c.id}_${createHash('sha256').update(c.voice + '|' + c.script).digest('hex').slice(0, 10)}`);
  if (!(await exists(`${base}.wav`))) {
    await run('say', ['-v', c.voice, '-o', `${base}.aiff`, c.script]);
    await run('afconvert', ['-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', `${base}.aiff`, `${base}.wav`]);
  }
  const cache = `${base}.scribe.json`, file = path.basename(`${base}.wav`);
  if (await exists(cache)) { cachedCalls++; return { text: JSON.parse(await readFile(cache, 'utf8')).text.trim(), file }; }
  if (!process.env.ELEVENLABS_API_KEY) throw new Error('ELEVENLABS_API_KEY is needed for uncached clips');
  const form = new FormData();
  form.append('model_id', 'scribe_v2'); form.append('language_code', 'en'); form.append('tag_audio_events', 'false');
  form.append('file', new Blob([await readFile(`${base}.wav`)], { type: 'audio/wav' }), file);
  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY }, body: form });
  const body = await res.text();
  if (!res.ok) throw new Error(`Scribe HTTP ${res.status}: ${body.slice(0, 200)}`);
  apiCalls++;
  const json = JSON.parse(body);
  await writeFile(cache, JSON.stringify({ text: json.text, language_code: json.language_code }, null, 2));
  return { text: json.text.trim(), file };
}
const cases = [];
for (const c of CASES) {
  const { text, file } = await speakAndTranscribe(c);
  const r = check(text);
  const correct = (r.verdict === 'likely_scam') === (c.intended === 'scam');
  cases.push({ case_id: c.id, kind: c.kind, voice: `${c.voice} (macOS, ${c.voice_accent})`, intended: c.intended, script: c.script, audio: file,
    scribe_heard: text, transcript_exact: text.toLowerCase().replace(/[^a-z0-9 ]/g, '') === c.script.toLowerCase().replace(/[^a-z0-9 ]/g, ''),
    flags: r.flags.map((id) => FLAGS.find((f) => f.id === id).label), score: r.score, verdict: r.verdict, verdict_text: VERDICT[r.verdict], correct });
}
const out = {
  kind: 'scripted_simulation',
  description: 'Five scripted phone calls (three scams, two normal), spoken by macOS synthetic voices, transcribed by ElevenLabs Scribe v2 (real API), and checked against fixed red-flag rules.',
  limits: ['Scripted calls and synthetic voices, not real scam recordings.', 'Five cases: a demonstration, not a measured accuracy rate.', 'Rules look at what is said; they do not detect whether a voice is AI-generated.', 'Not run through the live ElevenLabs agent.'],
  flags: FLAGS.map(({ id, label, weight }) => ({ id, label, weight })),
  summary: { cases: cases.length, correct: cases.filter((c) => c.correct).length, scams_flagged: cases.filter((c) => c.intended === 'scam' && c.verdict === 'likely_scam').length,
    scams: cases.filter((c) => c.intended === 'scam').length, exact_transcripts: cases.filter((c) => c.transcript_exact).length },
  generated_at: new Date().toISOString(), scribe_calls: { new: apiCalls, cached: cachedCalls }, cases,
};
await writeFile(path.resolve(args.out), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out.summary), JSON.stringify(out.scribe_calls));
for (const c of cases) console.log(`${c.case_id} ${c.intended} -> ${c.verdict} [${c.flags.join('; ')}] | heard="${c.scribe_heard}"`);
