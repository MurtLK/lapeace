"""Synthetic examples test math only; these are not provider findings."""

import unittest

from lapeace_data.metrics import aggregate, edit_distance, normalize, score


class NormalizationTests(unittest.TestCase):
    def test_unicode_case_punctuation_and_whitespace(self):
        self.assertEqual(normalize("  CAFE\u0301\tSTRAẞE—don't!\n"), "café strasse don t")

    def test_diacritics_numbers_and_symbols_are_preserved(self):
        self.assertEqual(normalize("Fünf 12 + 3 = 15"), "fünf 12 + 3 = 15")

    def test_nfc_equivalents_score_identically(self):
        result = score("café", "CAFE\u0301")
        self.assertEqual((result["wer"], result["cer"]), (0, 0))


class ScoringTests(unittest.TestCase):
    def test_edit_distance_substitution_insertion_and_deletion(self):
        self.assertEqual(edit_distance(["a", "b", "c"], ["a", "x", "c", "d"]), 2)
        self.assertEqual(edit_distance(["a", "b"], []), 2)
        self.assertEqual(edit_distance([], ["a"]), 1)

    def test_reference_must_have_normalized_content(self):
        for reference in ("", "  \t", "—!?..."):
            with self.subTest(reference=reference), self.assertRaisesRegex(ValueError, "reference"):
                score(reference, "anything")

    def test_successful_empty_prediction_is_all_deletions(self):
        result = score("one two", "")
        self.assertEqual(result, {"word_edits": 2, "reference_words": 2,
                                  "character_edits": 6, "reference_characters": 6,
                                  "wer": 1, "cer": 1})

    def test_insertion_heavy_scores_are_not_clamped(self):
        result = score("a", "a b c d")
        self.assertEqual(result["wer"], 3)
        self.assertEqual(result["cer"], 3)

    def test_cer_removes_whitespace_but_wer_keeps_boundaries(self):
        result = score("ab cd", "abcd")
        self.assertEqual(result["cer"], 0)
        self.assertEqual(result["wer"], 1)


class AggregateTests(unittest.TestCase):
    def test_micro_aggregation_uses_reference_denominators(self):
        records = [{"status": "succeeded", **score("a", "")},
                   {"status": "succeeded", **score("b c d e f g h i j", "b c d e f g h i j")}]
        result = aggregate(records)
        self.assertEqual(result["wer"], 0.1)
        self.assertEqual(result["cer"], 0.1)
        self.assertNotEqual(result["wer"], sum(r["wer"] for r in records) / 2)
        self.assertEqual((result["n_selected"], result["n_succeeded"]), (2, 2))

    def test_failed_and_pending_results_do_not_become_zero_errors(self):
        result = aggregate([{"status": "failed", "wer": None, "cer": None},
                            {"status": "pending", "wer": None, "cer": None}])
        self.assertEqual((result["n_succeeded"], result["n_failed"], result["n_pending"]), (0, 1, 1))
        for key in ("wer", "cer", "word_edits", "reference_words", "character_edits", "reference_characters"):
            self.assertIsNone(result[key], key)

    def test_partial_aggregate_scores_successes_only_and_retains_counts(self):
        success = {"status": "succeeded", **score("one two", "one")}
        result = aggregate([success, {"status": "failed"}, {"status": "pending"}])
        self.assertEqual(result["wer"], 0.5)
        self.assertEqual((result["n_selected"], result["n_succeeded"], result["n_failed"], result["n_pending"]),
                         (3, 1, 1, 1))

    def test_empty_cohort_has_null_metrics(self):
        result = aggregate([])
        self.assertEqual(result["n_selected"], 0)
        self.assertIsNone(result["wer"])
        self.assertIsNone(result["cer"])


if __name__ == "__main__":
    unittest.main()
