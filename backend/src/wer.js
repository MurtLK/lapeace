// Text normalization and word error rate. The same normalize() is applied to
// reference and transcript: Unicode NFKC, lowercase, punctuation -> space,
// apostrophes dropped ("don't" -> "dont"), whitespace collapsed.
// Numbers are NOT normalized: "six" vs "6" counts as a substitution.

export function normalize(text) {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/['’‘`]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function words(text) {
  const n = normalize(text);
  return n ? n.split(' ') : [];
}

// Levenshtein alignment over words. WER = (S + D + I) / N, N = reference words.
export function wordErrors(reference, hypothesis) {
  const ref = words(reference);
  const hyp = words(hypothesis);
  const rows = ref.length + 1;
  const cols = hyp.length + 1;
  // cost[i][j] = [edits, S, D, I] for ref[0..i) vs hyp[0..j)
  let prev = Array.from({ length: cols }, (_, j) => [j, 0, 0, j]);
  for (let i = 1; i < rows; i++) {
    const cur = [[i, 0, i, 0]];
    for (let j = 1; j < cols; j++) {
      const same = ref[i - 1] === hyp[j - 1];
      const diag = prev[j - 1];
      const up = prev[j]; // deletion (reference word missed)
      const left = cur[j - 1]; // insertion (extra word added)
      const options = [
        [diag[0] + (same ? 0 : 1), diag[1] + (same ? 0 : 1), diag[2], diag[3]],
        [up[0] + 1, up[1], up[2] + 1, up[3]],
        [left[0] + 1, left[1], left[2], left[3] + 1],
      ];
      cur.push(options.reduce((a, b) => (b[0] < a[0] ? b : a)));
    }
    prev = cur;
  }
  const [edits, substitutions, deletions, insertions] = prev[cols - 1];
  return {
    reference_words: ref.length,
    substitutions,
    deletions,
    insertions,
    wer: ref.length ? edits / ref.length : hyp.length ? 1 : 0,
  };
}

// Full word alignment (same costs and tie order as wordErrors: diagonal, then deletion, then
// insertion), for word-diff display. ops: [{op:'equal'|'sub'|'del'|'ins', ref, hyp}].
export function alignWords(reference, hypothesis, wordsFn = words) {
  const ref = wordsFn(reference);
  const hyp = wordsFn(hypothesis);
  const R = ref.length, H = hyp.length;
  const cost = Array.from({ length: R + 1 }, (_, i) => new Int32Array(H + 1).fill(0).map((_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= R; i++) {
    for (let j = 1; j <= H; j++) {
      const diag = cost[i - 1][j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1);
      const up = cost[i - 1][j] + 1;
      const left = cost[i][j - 1] + 1;
      cost[i][j] = Math.min(diag, up, left);
    }
  }
  const ops = [];
  let i = R, j = H;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && cost[i][j] === cost[i - 1][j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1)) {
      ops.push({ op: ref[i - 1] === hyp[j - 1] ? 'equal' : 'sub', ref: ref[i - 1], hyp: hyp[j - 1] });
      i--; j--;
    } else if (i > 0 && cost[i][j] === cost[i - 1][j] + 1) {
      ops.push({ op: 'del', ref: ref[i - 1], hyp: null });
      i--;
    } else {
      ops.push({ op: 'ins', ref: null, hyp: hyp[j - 1] });
      j--;
    }
  }
  ops.reverse();
  const errors = ops.filter((o) => o.op !== 'equal').length;
  return { ops, errors, reference_words: R, wer: R ? errors / R : H ? 1 : 0 };
}

// A/B normalization (applied identically to reference and both systems). Superset of normalize():
// expands "X'll" -> "X will", collapses stutter fragments ("s-scoop", "fro-fro-from", "th- the"),
// removes spoken fillers, maps digits 0-10 to words. Never used for the published benchmark WER.
const FILLER_WORDS = new Set(['uh', 'um', 'uhm', 'umm', 'er', 'erm', 'ah', 'hmm', 'mm', 'mhm', 'eh']);
const DIGITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
export function wordsAB(text) {
  let t = text.normalize('NFKC').toLowerCase().replace(/[’‘`]/g, "'");
  t = t.replace(/\b(we|she|he|you|they|i)'ll\b/g, '$1 will');
  t = t.replace(/\b(\d{1,2})\b/g, (m, d) => (Number(d) <= 10 ? DIGITS[Number(d)] : m));
  // Split on whitespace first so hyphenated tokens can be inspected.
  const raw = t.split(/\s+/).filter(Boolean);
  const out = [];
  for (let k = 0; k < raw.length; k++) {
    let tok = raw[k].replace(/^[^\p{L}\p{N}-]+|[^\p{L}\p{N}-]+$/gu, '');
    if (!tok) continue;
    if (tok.includes('-')) {
      const parts = tok.split('-').filter(Boolean);
      const nextWord = (raw[k + 1] || '').replace(/[^\p{L}\p{N}]/gu, '');
      if (tok.endsWith('-') && parts.length && nextWord.startsWith(parts[parts.length - 1])) continue; // "th- the"
      const last = parts[parts.length - 1] || '';
      if (parts.length > 1 && parts.slice(0, -1).every((p) => last.startsWith(p))) { tok = last; } // "s-scoop"
      else { out.push(...parts.map((p) => p.replace(/'/g, '').replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean)); continue; }
    }
    tok = tok.replace(/'/g, '').replace(/[^\p{L}\p{N}]/gu, ' ').trim();
    for (const w of tok.split(/\s+/)) if (w && !FILLER_WORDS.has(w)) out.push(w);
  }
  return out;
}
