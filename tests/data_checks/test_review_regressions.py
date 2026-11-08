"""Regressions for Antigravity findings; fixtures are synthetic, not speech evidence."""

import contextlib
import csv
import io
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch

from data_checks.test_offline import synthetic_selection
from lapeace_data.__main__ import main
from lapeace_data.artifacts import digest, file_hash, read_json, write_csv, write_json
from lapeace_data.pilot import prepare_pilot, validate_pending_bundle
from lapeace_data.wards import census_context


class ReviewRegressions(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / "source"
        self.manifest, self.data, self.config = synthetic_selection(self.source)
        self.hash = digest(self.manifest)
        self.run_id = "pending-" + self.hash[:16]
        self.output_root = self.root / "derived"
        self.data["wards"] = [
            {"ward": str(i), "population_language_base": "100", "ward10_corrected": str(i == 10),
             "knows_neither_english_nor_french": "5", "top14_nonofficial_home_language_speakers": "60",
             "home_urdu": "30", "home_arabic": "20", "home_mandarin": "10"}
            for i in range(1, 12)
        ]
        with patch("lapeace_data.pilot.selection_manifest", return_value=self.manifest):
            self.pilot = prepare_pilot(self.source, self.data, self.config, self.output_root)
        self.manifest_path = self.pilot / "manifest.json"
        self.run_dir = self.pilot / "runs" / self.run_id

    def run_cli(self, stage, extra=()):
        args = [stage, "--source", str(self.source), "--output-dir", str(self.output_root),
                "--raw-dir", str(self.root / "raw"), *extra]
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()), \
             patch("lapeace_data.__main__.discover", return_value=(self.source, {})), \
             patch("lapeace_data.__main__.validate_dataset", return_value=self.data), \
             patch("lapeace_data.pilot.selection_manifest", return_value=self.manifest):
            return main(args)

    def review_records(self):
        with (self.pilot / "review_queue.csv").open(newline="") as stream:
            reader = csv.DictReader(stream)
            return reader.fieldnames, list(reader)

    def validate(self):
        validate_pending_bundle(self.pilot, self.manifest, self.hash, self.run_id)

    def add_wards(self):
        timestamp = read_json(self.pilot / "preparation.json")["generated_at"]
        value = census_context(self.manifest, self.hash, self.data, timestamp)
        write_json(self.pilot / "wards.json", value, "Wards")
        return value

    def test_estimate_never_writes_beside_a_manifest_even_inside_source(self):
        source_manifest = self.source / "copied-pilot"
        shutil.copytree(self.pilot, source_manifest)
        report = source_manifest / "dry-run.json"
        report.write_text("Existing source file must remain untouched")
        before = {p.relative_to(source_manifest): file_hash(p) for p in source_manifest.rglob("*") if p.is_file()}
        for flags in ([], ["--dry-run"]):
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                self.assertEqual(main(["transcribe", "--manifest", str(source_manifest / "manifest.json"), *flags]), 0)
            self.assertIn('"network_requests": 0', output.getvalue())
            self.assertEqual(before, {p.relative_to(source_manifest): file_hash(p)
                                     for p in source_manifest.rglob("*") if p.is_file()})

    def test_ward_export_rejects_manifest_inside_source_before_any_writes(self):
        path = self.source / "copied-pilot"
        shutil.copytree(self.pilot, path)
        before = {p.relative_to(path): file_hash(p) for p in path.rglob("*") if p.is_file()}
        self.assertEqual(self.run_cli("export-wards", ["--manifest", str(path / "manifest.json")]), 1)
        self.assertEqual(before, {p.relative_to(path): file_hash(p) for p in path.rglob("*") if p.is_file()})
        self.assertFalse((self.output_root / "validation.json").exists())

    def test_ward_export_rejects_manifest_outside_selected_output_root(self):
        path = self.root / "unrelated-pilot"
        shutil.copytree(self.pilot, path)
        self.assertEqual(self.run_cli("export-wards", ["--manifest", str(path / "manifest.json")]), 1)
        self.assertFalse((path / "wards.json").exists())

    def test_ward_export_rejects_symlink_escape_from_output_root(self):
        external = self.root / "external"
        shutil.copytree(self.pilot, external)
        alias = self.output_root / "outside-link"
        alias.symlink_to(external, target_is_directory=True)
        self.assertEqual(self.run_cli("export-wards", ["--manifest", str(alias / "manifest.json")]), 1)
        self.assertFalse((external / "wards.json").exists())

    def test_review_requires_all_headers_and_complete_rows(self):
        fields, records = self.review_records()
        for missing in ("status", "meaning_review", "reference_override", "reviewer"):
            with self.subTest(missing=missing):
                write_csv(self.pilot / "review_queue.csv", records, [f for f in fields if f != missing])
                with self.assertRaisesRegex(ValueError, "headers"):
                    self.validate()
        write_csv(self.pilot / "review_queue.csv", records, fields)
        with (self.pilot / "review_queue.csv").open("a") as stream:
            stream.write("incomplete,row\n")
        with self.assertRaisesRegex(ValueError, "Malformed CSV"):
            self.validate()

    def test_review_sample_metadata_is_immutable(self):
        fields, records = self.review_records()
        for column in ("source_relative_path", "first_language", "spoken_language"):
            with self.subTest(column=column):
                changed = [dict(r) for r in records]
                changed[0][column] = "changed"
                write_csv(self.pilot / "review_queue.csv", changed, fields)
                with self.assertRaisesRegex(ValueError, "metadata"):
                    self.validate()

    def test_review_rejects_unknown_status_enums(self):
        fields, records = self.review_records()
        for column in ("status", "meaning_review"):
            with self.subTest(column=column):
                changed = [dict(r) for r in records]
                changed[0][column] = "unknown"
                write_csv(self.pilot / "review_queue.csv", changed, fields)
                with self.assertRaisesRegex(ValueError, "review status"):
                    self.validate()

    def test_ward_export_requires_complete_pending_bundle(self):
        for filename in ("run.json", "summary.json", "results.jsonl"):
            path = self.run_dir / filename
            original = path.read_bytes()
            path.unlink()
            try:
                with self.subTest(filename=filename):
                    self.assertEqual(self.run_cli("export-wards", ["--manifest", str(self.manifest_path)]), 1)
                    self.assertFalse((self.output_root / "offline-pilot.json").exists())
                    self.assertFalse((self.pilot / "wards.json").exists())
            finally:
                path.write_bytes(original)

    def test_ward_export_rejects_mixed_run_settings(self):
        path = self.run_dir / "run.json"
        run = read_json(path)
        run["model_id"] = "different-model"
        write_json(path, run)
        self.assertEqual(self.run_cli("export-wards", ["--manifest", str(self.manifest_path)]), 1)
        self.assertFalse((self.output_root / "offline-pilot.json").exists())

    def test_select_rejects_fabricated_recognition_index(self):
        wards = self.add_wards()
        wards["wards"][0]["index"] = 50
        write_json(self.pilot / "wards.json", wards)
        self.assertEqual(self.run_cli("select"), 1)
        self.assertFalse((self.output_root / "offline-pilot.json").exists())

    def test_select_rechecks_census_counts_against_source(self):
        wards = self.add_wards()
        wards["wards"][0]["covered_home_speakers"] += 1
        write_json(self.pilot / "wards.json", wards)
        self.assertEqual(self.run_cli("select"), 1)

    def test_valid_ward_export_and_rerun_preserve_review_work(self):
        fields, records = self.review_records()
        records[0].update(status="accepted", meaning_review="verified", reviewer="Fixture reviewer",
                          reviewed_at="2026-11-07T12:00:00+00:00", reason="Synthetic test only")
        write_csv(self.pilot / "review_queue.csv", records, fields)
        before = file_hash(self.pilot / "review_queue.csv")
        self.assertEqual(self.run_cli("export-wards", ["--manifest", str(self.manifest_path)]), 0)
        self.assertEqual(self.run_cli("select"), 0)
        self.assertEqual(file_hash(self.pilot / "review_queue.csv"), before)

    def test_missing_preparation_is_not_silently_recreated(self):
        path = self.pilot / "preparation.json"
        path.unlink()
        self.assertEqual(self.run_cli("prepare"), 1)
        self.assertFalse(path.exists())

    def test_missing_run_does_not_reset_review_work(self):
        (self.run_dir / "run.json").unlink()
        before = file_hash(self.pilot / "review_queue.csv")
        self.assertEqual(self.run_cli("prepare"), 1)
        self.assertFalse((self.run_dir / "run.json").exists())
        self.assertEqual(file_hash(self.pilot / "review_queue.csv"), before)


if __name__ == "__main__":
    unittest.main()
