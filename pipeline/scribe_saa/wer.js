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
