// Per-speaker-group WER summary, computed from the same records /api/samples serves.
// All WER values are fractions (0.05 = 5% of reference words wrong).
import { wordErrors, normalize } from './wer.js';

export const HIGH_WER_THRESHOLD = 0.05;
// Spoken hesitations Scribe writes verbatim; removed only in the filler sensitivity block.
export const FILLERS = ['uh', 'um', 'er', 'ah', 'eh', 'hmm', 'mm', 'uhm', 'erm'];
const FILLER_SET = new Set(FILLERS);

const round = (x) => Math.round(x * 10000) / 10000;
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
function median(a) {
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function stats(wers) {
  const above = wers.filter((w) => w > HIGH_WER_THRESHOLD).length;
  return {
    mean_wer: round(mean(wers)),
    median_wer: round(median(wers)),
    clips_above_threshold: above,
    share_above_threshold: round(above / wers.length),
  };
}

export function withoutFillers(text) {
  return normalize(text).split(' ').filter((w) => w && !FILLER_SET.has(w)).join(' ');
}

export function summarizeGroups(samples) {
  const byGroup = new Map();
  for (const s of samples) {
    if (typeof s.wer !== 'number') continue; // fixture rows have wer: null
    if (!byGroup.has(s.speaker_group)) byGroup.set(s.speaker_group, []);
    byGroup.get(s.speaker_group).push(s);
  }
  const groups = [...byGroup].map(([group, rows]) => {
    const raw = stats(rows.map((r) => r.wer));
    const noFill = stats(rows.map((r) => wordErrors(r.reference_transcript, withoutFillers(r.scribe_transcript)).wer));
    return {
      speaker_group: group,
      clips: rows.length,
      ...raw,
      filler_sensitivity: noFill,
    };
  });
  groups.sort((a, b) => b.mean_wer - a.mean_wer || a.speaker_group.localeCompare(b.speaker_group));
  return groups;
}
