"""Synthetic text/audio fixtures verify imports and index math, never measured findings."""

import contextlib
import copy
import csv
import io
from pathlib import Path
import socket
import tempfile
import unittest
from unittest.mock import patch

from data_checks.test_offline import synthetic_selection
from lapeace_data.__main__ import main
from lapeace_data.artifacts import check, digest, file_hash, read_json, write_csv, write_json
from lapeace_data.imported import corrected_references, import_buzz, score_imported
from lapeace_data.pilot import prepare_pilot
from lapeace_data.wards import recognition_context


class ImportedTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source, self.output, self.buzz = self.root / "source", self.root / "derived", self.root / "buzz"
        self.buzz.mkdir()
        self.manifest, self.data, self.config = synthetic_selection(self.source)
        self.data["wards"] = [{"ward": str(w), "population_language_base": "1000", "ward10_corrected": str(w == 10),
                               "knows_neither_english_nor_french": "25", "home_urdu": str(w * 10),
                               "home_arabic": "50", "home_mandarin": "20",
                               "top14_nonofficial_home_language_speakers": str(w * 10 + 100)} for w in range(1, 12)]
        self.rows = [{"audio_file": Path(m["file"]).name, "speaker_group": m["language"],
                      "transcript": "red blue", "WER": "999", "SER": "not used"} for m in self.data["metadata"]]
        self.reference = self.root / "references.csv"
        self.rows[0]["transcript"] = "red blue"  # Additional nonselected rows are retained, not scored.
        first_urdu = next(s for s in self.manifest["samples"] if s["cohort_id"] == "urdu")
        name = Path(first_urdu["source_relative_path"]).name
        next(r for r in self.rows if r["audio_file"] == name)["transcript"] = "red blue long reference"
        self.save_csv()
        for sample in self.manifest["samples"]:
            stem = Path(sample["source_relative_path"]).stem
            (self.buzz / (stem + ".mp3")).write_bytes((self.source / sample["source_relative_path"]).read_bytes())
            text = {"english": "red blue", "urdu": "red green", "arabic": "red blue extra", "mandarin": ""}[sample["cohort_id"]]
            (self.buzz / (stem + " (transcribed on fixture).txt")).write_text(text)
        with patch("lapeace_data.pilot.selection_manifest", return_value=self.manifest):
            self.pilot = prepare_pilot(self.source, self.data, self.config, self.output)
        self.parent = self.pilot / "manifest.json"
        self.validator = patch("lapeace_data.imported.validate_dataset", return_value=self.data)
        self.validator.start()
        self.addCleanup(self.validator.stop)

    def save_csv(self):
        write_csv(self.reference, self.rows, ["audio_file", "speaker_group", "transcript", "WER", "SER"])

    def run_import(self, **kwargs):
        with patch.object(socket, "socket", side_effect=AssertionError("Network forbidden")):
            return import_buzz(self.parent, self.source, self.reference, self.buzz, self.output,
                               reviewer="Friend (synthetic fixture)", attested_by="Fixture owner", origin="fixture", **kwargs)

    def test_import_uses_corrected_reference_and_original_prediction_not_supplied_scores(self):
        before = file_hash(self.reference), file_hash(self.parent)
        report = self.run_import(uniform_settings=True)
        self.assertEqual(report["network_requests"], 0)
        self.assertEqual(report["selected_clips"], 40)
        self.assertEqual(report["reference_rows"], 48)
        self.assertEqual(before, (file_hash(self.reference), file_hash(self.parent)))
        run_dir = Path(report["run_directory"])
        run = read_json(run_dir / "run.json")
        self.assertEqual(run["origin"], "fixture")
        self.assertIsNone(run["model_id"])
        self.assertIsNone(run["settings"])
        results = [__import__("json").loads(line) for line in (run_dir / "results.jsonl").read_text().splitlines()]
        self.assertEqual(len(results), 40)
        self.assertTrue(all(r["completed_at"] is None and r["provider_request_id"] is None for r in results))
        groups = {c["cohort_id"]: c for c in report["summary"]["cohorts"]}
        self.assertEqual(groups["english"]["wer"], 0)
        self.assertEqual(groups["urdu"]["word_edits"], 12)
        self.assertEqual(groups["urdu"]["reference_words"], 22)
        self.assertEqual(groups["urdu"]["wer"], 12/22)
        self.assertEqual(groups["mandarin"]["wer"], 1)
        self.assertFalse(report["ward_index_ready"])  # Fixture cannot become measured provider evidence.

    def test_reimport_and_rescore_reproduce_without_rewriting_attestation_or_originals(self):
        first = self.run_import()
        folder = Path(first["run_directory"])
        saved = {p.name: file_hash(p) for p in folder.iterdir() if p.is_file()}
        second = self.run_import()
        self.assertEqual(first, second)
        self.assertEqual(saved, {p.name: file_hash(p) for p in folder.iterdir() if p.is_file()})
        self.assertEqual(first, score_imported(folder, self.output))

    def test_bad_reference_rows_rejected_before_import(self):
        changes = (lambda r:r.append(r[0]), lambda r:r.pop(next(i for i,r in enumerate(r) if r["audio_file"] == Path(self.manifest["samples"][0]["source_relative_path"]).name)),
                   lambda r:r[0].update(speaker_group="Incorrect"), lambda r:r[0].update(transcript="!!!"),
                   lambda r:r[0].update(audio_file="../outside.mp3"))
        original = copy.deepcopy(self.rows)
        for change in changes:
            self.rows = copy.deepcopy(original)
            change(self.rows)
            self.save_csv()
            with self.assertRaises(ValueError):
                self.run_import()
        self.assertFalse((self.output / "imported").exists())

    def test_duplicate_and_missing_original_exports_rejected(self):
        first = next(self.buzz.glob("*.txt"))
        stem = first.name.split(" (transcribed on ")[0]
        duplicate = self.buzz / (stem + ".txt")
        duplicate.write_text("extra")
        with self.assertRaises(ValueError):
            self.run_import()
        duplicate.unlink()
        first.unlink()
        with self.assertRaises(ValueError):
            self.run_import()

    def test_mismatched_adjacent_audio_and_changed_source_are_rejected(self):
        adjacent = next(self.buzz.glob("*.mp3"))
        adjacent.write_bytes(b"wrong audio")
        with self.assertRaises(ValueError):
            self.run_import()
        with patch("lapeace_data.imported.validate_dataset", return_value={**self.data, "audio_hashes": {}}), self.assertRaises(ValueError):
            self.run_import()

    def test_tampered_saved_prediction_reference_and_profile_are_rejected(self):
        report = self.run_import()
        folder = Path(report["run_directory"])
        for p in (next((folder / "inputs/predictions").glob("*.txt")), folder / "inputs/references.csv"):
            original = p.read_bytes()
            p.write_bytes(b"changed")
            with self.assertRaises(ValueError):
                score_imported(folder, self.output)
            p.write_bytes(original)
        path = folder / "run.json"
        run = read_json(path)
        run["identity"]["profile"]["uniform_settings_attested"] = True
        write_json(path, run)
        with self.assertRaises(ValueError):
            score_imported(folder, self.output)

    def test_symlink_outputs_and_source_outputs_rejected(self):
        with self.assertRaises(ValueError):
            import_buzz(self.parent, self.source, self.reference, self.buzz, self.source / "derived",
                        reviewer="fixture", attested_by="fixture", origin="fixture")
        report = self.run_import()
        path = Path(report["run_directory"]) / "summary.json"
        path.unlink()
        target = self.root / "outside.json"
        target.write_text("preserve")
        path.symlink_to(target)
        with self.assertRaises(ValueError):
            score_imported(report["run_directory"], self.output)
        self.assertEqual(target.read_text(), "preserve")

    def test_ward_formula_sorting_and_gates(self):
        report = self.run_import(uniform_settings=True)
        folder = Path(report["run_directory"])
        manifest = read_json(folder / "manifest.json")
        summary = copy.deepcopy(report["summary"])
        # Simulate the provider eligibility flag in a pure calculation, without promoting a fixture run.
        summary["provenance"]["origin"] = "provider"
        result = recognition_context(manifest, digest(manifest), self.data, summary, report["run_id"], uniform_settings=True)
        check(result, "EvaluatedWards")
        self.assertEqual(len(result["wards"]), 11)
        byward = {w["ward"]: w for w in result["wards"]}
        self.assertAlmostEqual(byward[1]["index"], 100*(10*(12/22)+50*.5+20*1)/80)
        self.assertTrue(byward[10]["ward10_corrected"])
        self.assertEqual([w["index"] for w in result["wards"]], sorted([w["index"] for w in result["wards"]], reverse=True))
        self.assertTrue(all(w["index"] is None for w in recognition_context(manifest, digest(manifest), self.data, summary, report["run_id"], uniform_settings=False)["wards"]))
        summary["cohorts"][0]["n_succeeded"] = 9
        self.assertTrue(all(w["index"] is None for w in recognition_context(manifest, digest(manifest), self.data, summary, report["run_id"], uniform_settings=True)["wards"]))

    def test_cli_routes_imported_scoring_without_calling_provider(self):
        report = self.run_import()
        with contextlib.redirect_stdout(io.StringIO()), patch.object(socket, "socket", side_effect=AssertionError("Network forbidden")):
            self.assertEqual(main(["score", "--run-dir", report["run_directory"], "--output-dir", str(self.output)]), 0)


if __name__ == "__main__":
    unittest.main()
