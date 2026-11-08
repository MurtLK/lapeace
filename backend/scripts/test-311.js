// 311 clarify-and-confirm test with scripted requests and known intended outcomes.
//
//   ELEVENLABS_API_KEY=... node scripts/test-311.js --work <dir for audio + cache> [--out data/clarify311.json]
//
// For each case: the scripted request is spoken by a macOS synthetic voice (`say`), transcribed by
// ElevenLabs Scribe v2 (real API call, cached), and classified by the fixed keyword rules below.
// That is the FIRST INTERPRETATION. The line always reads it back before acting. The caller's reply
// is scripted: "yes" if the interpretation matches the intended request, otherwise the scripted
// correction, which is also spoken, transcribed and classified. The result is the FINAL CONFIRMED INTENT.
// Tested: speech -> Scribe -> classifier. Scripted: wording, voices, and the caller's yes/no.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const { values: args } = parseArgs({ options: {
  work: { type: 'string' },
  out: { type: 'string', default: path.join(here, '..', 'data', 'clarify311.json') },
} });
if (!args.work) { console.error('Usage: node scripts/test-311.js --work <dir>'); process.exit(1); }

// Intents from the most common Toronto 311 request types (supplied 05_city_311_requests).
// Order breaks ties. Each keyword/phrase found adds 1 point.
export const INTENTS = [
  { id: 'garbage_not_picked_up', label: 'Garbage not picked up', toronto_type: 'Res / Garbage / Not Picked Up', keys: ['garbage', 'trash', 'black bin'] },
  { id: 'recycling_not_picked_up', label: 'Recycling not picked up', toronto_type: 'Res / Recycle / Not Picked Up', keys: ['recycling', 'blue bin', 'recycle'] },
  { id: 'bin_damaged', label: 'Bin damaged', toronto_type: 'Residential Bin Lid Damaged', keys: ['lid', 'cracked', 'broken', 'damaged', 'handle', 'wheel'] },
  { id: 'pothole', label: 'Pothole / road damage', toronto_type: 'Road Pothole / Road Damage', keys: ['pothole', 'hole in the road', 'road is damaged', 'hole'] },
  { id: 'tree_emergency', label: 'Fallen tree or branch', toronto_type: 'Tree Emergency Clean-Up', keys: ['tree', 'branch', 'fell', 'fallen', 'storm'] },
  { id: 'sidewalk_snow', label: 'Sidewalk snow not cleared', toronto_type: 'Sidewalk Snow Clearing Required', keys: ['snow', 'ice', 'icy', 'not cleared', "hasn't been cleared", 'plow'] },
  { id: 'injured_wildlife', label: 'Injured wildlife', toronto_type: 'Injured - Wildlife', keys: ['raccoon', 'animal', 'hurt', 'injured', 'limping', 'bird'] },
  { id: 'dead_wildlife', label: 'Dead wildlife pickup', toronto_type: 'Pick up Dead Wildlife', keys: ['raccoon', 'animal', 'dead', 'carcass', 'bird'] },
];
export function classify(text) {
  const t = ` ${text.toLowerCase().replace(/[^a-z' ]+/g, ' ').replace(/\s+/g, ' ')} `;
  const scored = INTENTS.map((i) => ({ id: i.id, score: i.keys.filter((k) => t.includes(` ${k} `) || t.includes(` ${k}s `)).length }));
  const best = scored.reduce((a, b) => (b.score > a.score ? b : a));
  return best.score === 0 ? { id: 'unknown', score: 0 } : best;
}
const label = (id) => INTENTS.find((i) => i.id === id)?.label ?? 'Not understood';

const CASES = [
  { id: 'c1', voice: 'Daniel', voice_accent: 'en-GB', intended: 'garbage_not_picked_up',
    request: "Hi, my garbage wasn't picked up this morning.", correction: 'No. My garbage was not collected.' },
  { id: 'c2', voice: 'Rishi', voice_accent: 'en-IN', intended: 'recycling_not_picked_up',
    request: 'My blue bin was skipped today, and the lid is cracked.', correction: 'No, I mean the recycling was not picked up.' },
  { id: 'c3', voice: 'Rishi', voice_accent: 'en-IN', intended: 'pothole',
    request: "There's a big hole in the road right outside my house.", correction: 'No, it is a pothole on my street.' },
  { id: 'c4', voice: 'Moira', voice_accent: 'en-IE', intended: 'tree_emergency',
    request: 'A huge branch fell in the storm, and now the sidewalk is blocked.', correction: 'No, a tree branch fell down.' },
  { id: 'c5', voice: 'Rishi', voice_accent: 'en-IN', intended: 'dead_wildlife',
    request: "There's a raccoon on my lawn and it isn't moving.", correction: 'No, I think the raccoon is dead. Please pick it up.' },
  { id: 'c6', voice: 'Daniel', voice_accent: 'en-GB', intended: 'sidewalk_snow',
    request: "The snow on the sidewalk on my street still hasn't been cleared.", correction: 'No, the sidewalk snow is not cleared.' },
];

const work = path.resolve(args.work);
await mkdir(work, { recursive: true });
const exists = (p) => access(p).then(() => true, () => false);
let apiCalls = 0, cachedCalls = 0;

async function speakAndTranscribe(key, voice, text) {
  const base = path.join(work, `${key}_${createHash('sha256').update(voice + '|' + text).digest('hex').slice(0, 10)}`);
  if (!(await exists(`${base}.wav`))) {
    await run('say', ['-v', voice, '-o', `${base}.aiff`, text]);
    await run('afconvert', ['-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', `${base}.aiff`, `${base}.wav`]);
  }
  const cache = `${base}.scribe.json`;
  const file = path.basename(`${base}.wav`);
  if (await exists(cache)) { cachedCalls++; return { text: JSON.parse(await readFile(cache, 'utf8')).text.trim(), file }; }
  if (!process.env.ELEVENLABS_API_KEY) throw new Error('ELEVENLABS_API_KEY is needed for uncached clips');
  const form = new FormData();
  form.append('model_id', 'scribe_v2');
  form.append('language_code', 'en');
  form.append('tag_audio_events', 'false');
  form.append('file', new Blob([await readFile(`${base}.wav`)], { type: 'audio/wav' }), path.basename(`${base}.wav`));
  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY }, body: form });
  const body = await res.text();
  if (!res.ok) throw new Error(`Scribe HTTP ${res.status}: ${body.slice(0, 200)}`);
  apiCalls++;
  const json = JSON.parse(body);
  await writeFile(cache, JSON.stringify({ text: json.text, language_code: json.language_code }, null, 2));
  return { text: json.text.trim(), file };
}

const results = [];
for (const c of CASES) {
  const { text: heard, file: requestAudio } = await speakAndTranscribe(c.id, c.voice, c.request);
  const first = classify(heard);
  const firstCorrect = first.id === c.intended;
  const turns = [
    { who: 'caller', text: c.request, scribe_heard: heard },
    { who: 'line', text: `I understood: ${label(first.id)}. Is that right?` },
  ];
  let final = first.id;
  let correctionHeard = null, correctionAudio = null;
  if (firstCorrect) {
    turns.push({ who: 'caller', text: 'Yes.', scripted: true });
  } else {
    ({ text: correctionHeard, file: correctionAudio } = await speakAndTranscribe(`${c.id}_fix`, c.voice, c.correction));
    final = classify(correctionHeard).id;
    turns.push({ who: 'caller', text: c.correction, scribe_heard: correctionHeard, scripted_reply: true });
    turns.push({ who: 'line', text: `Thanks. I understood: ${label(final)}. Is that right?` });
    turns.push({ who: 'caller', text: final === c.intended ? 'Yes.' : 'No.', scripted: true });
  }
  results.push({
    case_id: c.id, voice: `${c.voice} (macOS, ${c.voice_accent})`, intended: c.intended, intended_label: label(c.intended),
    request_script: c.request, request_audio: requestAudio, correction_audio: correctionAudio, scribe_heard: heard, transcript_exact: heard.toLowerCase().replace(/[^a-z ]/g, '') === c.request.toLowerCase().replace(/[^a-z ]/g, ''),
    first_interpretation: first.id, first_interpretation_label: label(first.id), first_correct: firstCorrect,
    correction_script: firstCorrect ? null : c.correction, correction_heard: correctionHeard,
    final_confirmed: final === c.intended ? final : null, final_confirmed_label: final === c.intended ? label(final) : 'Not confirmed',
    final_correct: final === c.intended, clarification_rounds: firstCorrect ? 0 : 1, turns,
  });
}

const out = {
  kind: 'tested_with_scripted_requests',
  description: 'Scripted 311 requests with known intended outcomes. Spoken by macOS synthetic voices, transcribed by ElevenLabs Scribe v2 (real API), classified by fixed keyword rules. The line always confirms before acting; caller yes/no replies are scripted.',
  tested: ['Scribe v2 transcription of each spoken request and correction', 'rule-based first interpretation from that transcript', 'final intent after one confirmation'],
  scripted: ['request and correction wording', 'synthetic voices (not real callers)', 'the caller\'s yes/no'],
  limits: ['Synthetic voices, not human callers or Mississauga residents.', 'Six cases: a demonstration, not a measured accuracy rate.', 'The intent rules are a simple stand-in for a real 311 router.', 'Not run through the ElevenLabs live agent.'],
  intents: INTENTS.map(({ id, label, toronto_type, keys }) => ({ id, label, toronto_type, keywords: keys })),
  summary: {
    cases: results.length,
    first_interpretation_correct: results.filter((r) => r.first_correct).length,
    corrected_after_clarification: results.filter((r) => !r.first_correct && r.final_correct).length,
    final_confirmed_correct: results.filter((r) => r.final_correct).length,
    exact_transcripts: results.filter((r) => r.transcript_exact).length,
  },
  generated_at: new Date().toISOString(),
  scribe_calls: { new: apiCalls, cached: cachedCalls },
  cases: results,
};
await writeFile(path.resolve(args.out), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out.summary), JSON.stringify(out.scribe_calls));
for (const r of results) console.log(`${r.case_id} [${r.voice}] intended=${r.intended} | heard="${r.scribe_heard}" | first=${r.first_interpretation}${r.first_correct ? ' OK' : ' WRONG'}${r.correction_heard ? ` | fix heard="${r.correction_heard}"` : ''} | final=${r.final_confirmed_label}`);
