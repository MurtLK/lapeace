// A/B comparison: ElevenLabs Scribe (baseline, from samples) vs one alternative STT model.
// Same audio, same reference, same scoring. Two scorings are reported side by side:
//   raw        = the published benchmark normalization (src/wer.js normalize/words)
//   normalized = wordsAB(): also removes fillers, expands "X'll", collapses stutters, digits->words
// WER is a fraction; *_diff_pp are percentage points (alternative - baseline; negative = alternative better).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { alignWords, wordsAB } from './wer.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(here, '..');
export const COMPARISON_FILE = process.env.COMPARISON_FILE ? path.resolve(backendRoot, process.env.COMPARISON_FILE) : null;

let cache = null;
export async function loadComparison() {
  if (!COMPARISON_FILE) return null;
  if (!cache) cache = JSON.parse(await readFile(COMPARISON_FILE, 'utf8'));
  return cache;
}

const round = (x, d = 4) => Math.round(x * 10 ** d) / 10 ** d;
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
function median(a) {
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function summarize(rows) {
  const out = {
    clips: rows.length,
    clips_with_dropped_passage: {
      baseline: rows.filter((r) => r.baseline.dropped_passage).length,
      alternative: rows.filter((r) => r.alternative.dropped_passage).length,
    },
  };
  for (const scoring of ['raw', 'normalized']) {
    const b = rows.map((r) => r.baseline[scoring]);
    const a = rows.map((r) => r.alternative[scoring]);
    out[scoring] = {
      baseline: { mean_wer: round(mean(b.map((x) => x.wer))), median_wer: round(median(b.map((x) => x.wer))) },
      alternative: { mean_wer: round(mean(a.map((x) => x.wer))), median_wer: round(median(a.map((x) => x.wer))) },
      mean_diff_pp: round((mean(a.map((x) => x.wer)) - mean(b.map((x) => x.wer))) * 100, 2),
      median_diff_pp: round((median(a.map((x) => x.wer)) - median(b.map((x) => x.wer))) * 100, 2),
      improved: rows.filter((r) => r.outcome[scoring] === 'improved').length,
      worse: rows.filter((r) => r.outcome[scoring] === 'worse').length,
      same: rows.filter((r) => r.outcome[scoring] === 'same').length,
    };
  }
  return out;
}

export const DROPPED_RUN_MIN = 5;
const longestDeletionRun = (ops) => ops.reduce((acc, o) => {
  acc.cur = o.op === 'del' ? acc.cur + 1 : 0;
  acc.max = Math.max(acc.max, acc.cur);
  return acc;
}, { cur: 0, max: 0 }).max;

function score(reference, text) {
  const raw = alignWords(reference, text);
  const norm = alignWords(reference, text, wordsAB);
  const run = longestDeletionRun(raw.ops);
  return {
    transcript: text,
    raw: { wer: round(raw.wer), errors: raw.errors },
    normalized: { wer: round(norm.wer), errors: norm.errors },
    longest_dropped_run: run,
    dropped_passage: run >= DROPPED_RUN_MIN,
    ops: raw.ops,
  };
}

const outcome = (b, a) => (a.errors < b.errors ? 'improved' : a.errors > b.errors ? 'worse' : 'same');

export function buildComparison(samples, cmp, toUrl, { includeOps = true, clipId = null } = {}) {
  const byId = new Map(samples.map((s) => [s.clip_id, s]));
  const rows = [];
  for (const t of cmp.transcripts) {
    const s = byId.get(t.clip_id);
    if (!s) continue;
    const baseline = score(s.reference_transcript, s.scribe_transcript);
    const alternative = score(s.reference_transcript, t.text);
    rows.push({
      clip_id: s.clip_id,
      speaker_group: s.speaker_group,
      audio_url: toUrl(s.audio_file),
      duration_sec: s.duration_sec,
      reference_transcript: s.reference_transcript,
      baseline,
      alternative,
      delta_wer: { raw: round(alternative.raw.wer - baseline.raw.wer), normalized: round(alternative.normalized.wer - baseline.normalized.wer) },
      outcome: { raw: outcome(baseline.raw, alternative.raw), normalized: outcome(baseline.normalized, alternative.normalized) },
      alternative_transcript_is_simulated: Boolean(cmp.simulated),
    });
  }

  // Featured: biggest error-count gap in each direction under the normalized scoring, at least 3 words,
  // preferring non-English groups, then shorter clips. A hand-picked override in the file wins.
  const gap = (r) => r.baseline.normalized.errors - r.alternative.normalized.errors;
  const pick = (sign) => [...rows]
    .filter((r) => sign * gap(r) >= 3)
    .sort((x, y) => sign * gap(y) - sign * gap(x)
      || (x.speaker_group === 'English') - (y.speaker_group === 'English')
      || x.duration_sec - y.duration_sec || x.clip_id.localeCompare(y.clip_id))[0]?.clip_id ?? null;
  const featured = { better: pick(1), worse: pick(-1), ...(cmp.featured_override || {}) };

  const groupNames = [...new Set(rows.map((r) => r.speaker_group))];
  const groups = groupNames.map((g) => ({ speaker_group: g, ...summarize(rows.filter((r) => r.speaker_group === g)) }));
  let clips = rows.sort((a, b) => a.delta_wer.normalized - b.delta_wer.normalized || a.clip_id.localeCompare(b.clip_id));
  if (clipId) clips = clips.filter((r) => r.clip_id === clipId);
  if (!includeOps) clips = clips.map(({ baseline, alternative, ...r }) => ({ ...r, baseline: { ...baseline, ops: undefined }, alternative: { ...alternative, ops: undefined } }));

  return {
    source: cmp.simulated ? 'fixture' : 'speech_accent_archive_comparison',
    notice: cmp.notice,
    wer_unit: 'fraction (0.05 = 5% of reference words wrong)',
    diff_unit: 'percentage points, alternative minus baseline (negative = alternative better)',
    scoring: {
      raw: 'Published benchmark rule: lowercase, punctuation removed, apostrophes dropped. Fillers (uh/um) and stutters count as errors; numbers not converted.',
      normalized: 'Fairer A/B rule, applied identically to both systems and the reference: raw rule plus fillers removed, "we\'ll"->"we will", stutter fragments collapsed ("s-scoop"->"scoop"), digits 0-10 as words.',
      outcome: 'improved/worse/same compares integer word-error counts for the same clip.',
      ops: 'Word diff against the reference using the raw rule. Tokens are normalized; show the raw transcript text separately.',
      dropped_passage: `true when the transcript skips ${DROPPED_RUN_MIN}+ consecutive reference words (a silently missing phrase or sentence).`,
    },
    systems: cmp.systems,
    featured,
    featured_notes: cmp.featured_notes || null,
    overall: summarize(rows),
    groups,
    clips,
  };
}
