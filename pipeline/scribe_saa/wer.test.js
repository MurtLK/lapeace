import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, wordErrors } from './wer.js';

test('normalize strips case and punctuation the same way', () => {
  assert.equal(normalize('Please call Stella.  Ask HER: "six" spoons!'), 'please call stella ask her six spoons');
  assert.equal(normalize("Don't stop"), 'dont stop');
});

test('identical after normalization -> 0', () => {
  assert.equal(wordErrors('Please call Stella.', 'please, call stella').wer, 0);
});

test('substitution, deletion, insertion counted', () => {
  const r = wordErrors('a b c d', 'a x c d e'); // b->x (S), +e (I)
  assert.deepEqual([r.substitutions, r.deletions, r.insertions], [1, 0, 1]);
  assert.equal(r.wer, 0.5);
  const d = wordErrors('a b c d', 'a d'); // 2 deletions
  assert.deepEqual([d.substitutions, d.deletions, d.insertions, d.wer], [0, 2, 0, 0.5]);
});

test('empty transcript -> WER 1', () => {
  assert.equal(wordErrors('a b', '').wer, 1);
});
