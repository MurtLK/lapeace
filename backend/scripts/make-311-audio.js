// Regenerate the 311 test's synthetic caller audio locally (macOS only; no API calls, no credits).
//   node scripts/make-311-audio.js [--out data/local/311-audio]
// Reads the scripted wording and voices from data/clarify311.json and writes the same file names
// the page expects. The transcripts and results in clarify311.json are NOT changed.
// The audio isn't committed: it's macOS system-voice output, and redistribution hasn't been checked.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, mkdir, access, rm } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const { values: args } = parseArgs({ options: { out: { type: 'string', default: path.join(here, '..', 'data', 'local', '311-audio') } } });
if (process.platform !== 'darwin') {
  console.error('This needs macOS (`say` and `afconvert`). Skip it: the page still shows the 311 results without audio.');
  process.exit(1);
}
const data = JSON.parse(await readFile(path.join(here, '..', 'data', 'clarify311.json'), 'utf8'));
const out = path.resolve(args.out);
await mkdir(out, { recursive: true });
const exists = (p) => access(p).then(() => true, () => false);
let made = 0;
for (const c of data.cases) {
  const voice = c.voice.split(' (')[0];
  for (const [file, text] of [[c.request_audio, c.request_script], [c.correction_audio, c.correction_script]]) {
    if (!file || !text) continue;
    const wav = path.join(out, file);
    if (await exists(wav)) continue;
    const aiff = wav.replace(/\.wav$/, '.aiff');
    await run('say', ['-v', voice, '-o', aiff, text]);
    await run('afconvert', ['-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', aiff, wav]);
    await rm(aiff, { force: true });
    made++;
  }
}
console.log(`311 audio: ${made} new file(s) in ${out}. Set CLARIFY_AUDIO_DIR=${path.relative(path.join(here, '..'), out)} in backend/.env`);
