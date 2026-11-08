"""Temporary toy fixtures test contracts, never recognition performance."""

import copy
import csv
import io
import json
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch
import warnings
import zipfile

from lapeace_data.artifacts import canonical_bytes, digest, file_hash, read_json, write_csv, write_json
from lapeace_data.dataset import (ACCENT, CENSUS, REQUIRED, contained_file, relative_name,
                                  rows, validate_dataset, validated_members)
from lapeace_data.pilot import (dry_run, ordered_candidates, prepare_pilot, read_frozen_manifest,
                                selection_manifest, validate_pending_bundle)
from lapeace_data.wards import census_context


def csv_file(path, records):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, list(records[0]))
        writer.writeheader()
        writer.writerows(records)


def synthetic_selection(root):
    """A complete toy pilot with mock decoding; never use as benchmark evidence."""
    config = read_json(Path(__file__).resolve().parents[2] / "config/pilot.json")
    paragraph = root / ACCENT / "elicitation_paragraph.txt"
    paragraph.parent.mkdir(parents=True)
    paragraph.write_text("Synthetic reference paragraph.\n")
    cohorts = [config["baseline"], *config["comparisons"]]
    data = {"metadata": [], "coverage": [], "crosswalk": [],
            "source_hashes": {f"{ACCENT}/elicitation_paragraph.txt": file_hash(paragraph)},
            "audio_hashes": {}, "counts_by_first_language": {c["first_language"]: 12 for c in cohorts}}
    for rank, cohort in enumerate(cohorts):
        language, ident = cohort["first_language"], cohort["cohort_id"]
        col = "" if rank == 0 else "home_" + ident
        data["coverage"].append({"language": language, "census_home_column": col,
                                 "accent_archive_speakers": "12", "city_home_speakers": str(0 if rank == 0 else 400-rank*100)})
        data["crosswalk"].append({"language": language, "census_home_column": col})
        for index in range(12):
            name = f"audio/{ident}{index:02d}.mp3"
            path = root / ACCENT / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(b"synthetic fixture")
            data["metadata"].append({"file": name, "language": language, "duration_sec": "1"})
            data["audio_hashes"][f"{ACCENT}/{name}"] = file_hash(path)
    with patch("lapeace_data.pilot.inspect_media", return_value={"duration_seconds": 1,
               "channels": 1, "sample_rate_hz": 16000, "decode_status": "passed"}), \
         patch("lapeace_data.pilot.subprocess.check_output", return_value="fixture version\n"):
        manifest = selection_manifest(root, data, config)
    return manifest, data, config


class ZipSafetyTests(unittest.TestCase):
    def zip_with(self, entries):
        data = io.BytesIO()
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            with zipfile.ZipFile(data, "w") as archive:
                for name in entries:
                    archive.writestr(name, b"synthetic fixture")
        data.seek(0)
        return zipfile.ZipFile(data)

    def test_rejects_absolute_traversal_and_windows_paths(self):
        for name in ("/outside.txt", "../outside.txt", "safe/../../outside.txt",
                     "safe\\..\\outside.txt", "C:/outside.txt"):
            with self.subTest(name=name), self.zip_with([name]) as archive, self.assertRaises(ValueError):
                validated_members(archive)

    def test_rejects_normalized_duplicate_paths(self):
        for names in (("safe/a.txt", "safe/a.txt"), ("safe/a.txt", "safe/./a.txt"),
                      ("safe/A.txt", "safe/a.txt"), ("safe/café.txt", "safe/cafe\u0301.txt")):
            with self.subTest(names=names), self.zip_with(names) as archive, self.assertRaises(ValueError):
                validated_members(archive)

    def test_rejects_zip_symlinks_and_special_files(self):
        for mode in (stat.S_IFLNK, stat.S_IFIFO):
            info = zipfile.ZipInfo("safe/link")
            info.create_system = 3
            info.external_attr = (mode | 0o777) << 16
            with self.subTest(mode=mode), self.zip_with([info]) as archive, self.assertRaises(ValueError):
                validated_members(archive)

    def test_accepts_safe_regular_entries(self):
        with self.zip_with(["safe/a.txt", "safe/b.txt"]) as archive:
            self.assertEqual([name for _, name in validated_members(archive)], ["safe/a.txt", "safe/b.txt"])


class LocalPathAndCsvTests(unittest.TestCase):
    def test_containment_rejects_traversal_missing_files_and_symlinks(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "audio").mkdir()
            (root / "audio/good.mp3").write_bytes(b"synthetic")
            self.assertEqual(contained_file(root, "audio/good.mp3"), root.resolve() / "audio/good.mp3")
            (root / "audio/link.mp3").symlink_to(root / "audio/good.mp3")
            (root / "linked").symlink_to(root / "audio", target_is_directory=True)
            for name in ("../outside", "audio/missing.mp3", "audio/link.mp3", "linked/good.mp3"):
                with self.subTest(name=name), self.assertRaises(ValueError):
                    contained_file(root, name)

    def test_empty_and_dot_relative_paths_are_rejected(self):
        for name in ("", ".", "/absolute", "../parent", "a\\b", "C:foo"):
            with self.subTest(name=name), self.assertRaises(ValueError):
                relative_name(name)

    def test_bom_csv_is_read_and_invalid_headers_or_rows_are_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            csv_file(root / "valid.csv", [{"id": "a", "language": "Urdu"}])
            self.assertEqual(rows(root, "valid.csv", ["id"])[0]["id"], "a")
            cases = {"duplicate.csv": "id,id\na,b\n", "missing.csv": "other\na\n",
                     "long.csv": "id\na,b\n", "short.csv": "id,name\na\n"}
            for name, value in cases.items():
                (root / name).write_text(value)
                with self.subTest(name=name), self.assertRaises(ValueError):
                    rows(root, name, ["id"])


class DatasetContractTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name in REQUIRED:
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("Synthetic test fixture; no real speech or findings.\n")
        self.metadata = [{"file": "audio/english1.mp3", "language": "English", "duration_sec": "1", "birth_country": "Canada"},
                         {"file": "audio/urdu1.mp3", "language": "Urdu", "duration_sec": "1", "birth_country": "Pakistan"}]
        self.crosswalk = [{"language": "English", "census_home_column": ""},
                          {"language": "Urdu", "census_home_column": "home_urdu"}]
        self.coverage = [{"language": "English", "city_home_speakers": "0", "accent_archive_speakers": "1", "census_home_column": ""},
                         {"language": "Urdu", "city_home_speakers": "110", "accent_archive_speakers": "1", "census_home_column": "home_urdu"}]
        self.wards = [{"ward": str(i), "ward10_corrected": str(i == 10), "population_language_base": "100",
                       "top14_nonofficial_home_language_speakers": "10", "home_urdu": "10",
                       "knows_neither_english_nor_french": "5"} for i in range(1, 12)]
        self.detail = [{"geo_level": "ward", "geo": str(i), "language": "Urdu", "home_speakers": "10",
                        "population_language_base": "100"} for i in range(1, 12)]
        for row in self.metadata:
            audio = self.root / ACCENT / row["file"]
            audio.parent.mkdir(parents=True, exist_ok=True)
            audio.write_bytes(b"synthetic, not decoded audio")
        self.write_tables()

    def write_tables(self):
        for name, records in [(f"{ACCENT}/metadata.csv", self.metadata), ("language_crosswalk.csv", self.crosswalk),
                              (f"{CENSUS}/language_coverage.csv", self.coverage),
                              (f"{CENSUS}/ward_language_profile_2021_corrected.csv", self.wards),
                              (f"{CENSUS}/geo_language_long.csv", self.detail)]:
            csv_file(self.root / name, records)

    def validate(self):
        self.write_tables()
        return validate_dataset(self.root, {})

    def test_validates_all_source_hashes_and_metadata_audio_paths(self):
        result = self.validate()
        self.assertEqual(result["counts_by_first_language"], {"English": 1, "Urdu": 1})
        self.assertEqual(len(result["audio_hashes"]), 2)
        self.assertEqual(len(result["wards"]), 11)
        self.assertEqual(result["audio_hashes"][f"{ACCENT}/audio/urdu1.mp3"],
                         file_hash(self.root / ACCENT / "audio/urdu1.mp3"))

    def test_blank_english_home_population_is_unavailable_not_zero(self):
        self.coverage[0]["city_home_speakers"] = ""
        result = self.validate()
        english = next(row for row in result["coverage"] if row["language"] == "English")
        self.assertEqual(english["city_home_speakers"], "")
        self.assertEqual(english["census_home_column"], "")

    def test_rejects_missing_ward(self):
        self.wards.pop()
        with self.assertRaisesRegex(ValueError, "wards 1 through 11"):
            self.validate()

    def test_rejects_uncorrected_ward10(self):
        self.wards[9]["ward10_corrected"] = "False"
        with self.assertRaisesRegex(ValueError, "Ward 10"):
            self.validate()

    def test_rejects_zero_language_denominator(self):
        self.wards[0]["population_language_base"] = "0"
        with self.assertRaisesRegex(ValueError, "denominator"):
            self.validate()

    def test_rejects_corrected_ward_detail_count_mismatch(self):
        self.detail[9]["home_speakers"] = "1"
        with self.assertRaisesRegex(ValueError, "ward/detail mismatch"):
            self.validate()

    def test_rejects_non_canadian_english_baseline(self):
        self.metadata[0]["birth_country"] = "USA"
        with self.assertRaisesRegex(ValueError, "Canadian-born"):
            self.validate()

    def test_rejects_coverage_metadata_mismatch_and_invalid_duration(self):
        self.coverage[1]["accent_archive_speakers"] = "2"
        with self.assertRaisesRegex(ValueError, "count mismatch"):
            self.validate()
        self.coverage[1]["accent_archive_speakers"] = "1"
        for value in ("nan", "inf", "0", "-1"):
            self.metadata[1]["duration_sec"] = value
            with self.subTest(value=value), self.assertRaisesRegex(ValueError, "duration"):
                self.validate()

    def test_missing_audio_fails_and_changed_audio_changes_hash(self):
        before = self.validate()["audio_hashes"]
        audio = self.root / ACCENT / "audio/urdu1.mp3"
        audio.write_bytes(b"different synthetic bytes")
        self.assertNotEqual(before, self.validate()["audio_hashes"])
        audio.unlink()
        with self.assertRaisesRegex(ValueError, "Missing or unsafe"):
            self.validate()


class SelectionTests(unittest.TestCase):
    def test_selection_is_order_independent_and_does_not_mutate_inputs(self):
        records = [{"file": f"audio/{i}.mp3"} for i in range(20)]
        before = copy.deepcopy(records)
        forward = ordered_candidates(records, 20261107)
        reverse = ordered_candidates(list(reversed(records)), 20261107)
        self.assertEqual(forward, reverse)
        self.assertEqual(records, before)
        self.assertEqual({r["file"] for r in forward}, {r["file"] for r in records})
        self.assertNotEqual(forward, ordered_candidates(records, 123))

    def test_each_cohort_uses_fresh_rng_and_all_spoken_language_is_english(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            manifest, data, config = synthetic_selection(root)
            cohorts = [config["baseline"], *config["comparisons"]]
            before = copy.deepcopy(data)
            with patch("lapeace_data.pilot.inspect_media", return_value={"duration_seconds": 1,
                       "channels": 1, "sample_rate_hz": 16000, "decode_status": "passed"}), \
                 patch("lapeace_data.pilot.subprocess.check_output", return_value="fixture version\n"):
                manifest = selection_manifest(root, data, config)
                repeated = selection_manifest(root, data, config)
            self.assertEqual(digest(manifest), digest(repeated))
            self.assertEqual(len(manifest["samples"]), 40)
            self.assertEqual(data, before)
            selections = []
            for cohort in cohorts:
                samples = [s for s in manifest["samples"] if s["cohort_id"] == cohort["cohort_id"]]
                self.assertEqual(len(samples), 10)
                self.assertEqual(len(manifest["reserves"][cohort["cohort_id"]]), 2)
                selected_ids = {s["sample_id"] for s in samples}
                self.assertFalse(selected_ids.intersection(manifest["reserves"][cohort["cohort_id"]]))
                selections.append([s["sample_id"][-2:] for s in samples])
                for sample in samples:
                    self.assertEqual(sample["spoken_language"], "en")
                    self.assertEqual(sample["first_language"], cohort["first_language"])
                    self.assertEqual(sample["review_status"], "pending")
            self.assertTrue(all(s == selections[0] for s in selections))

    def test_dry_run_exposes_exhausted_budget_without_claiming_live_readiness(self):
        manifest = {"selection_config": {"budget": {"max_attempts": 1, "max_submitted_audio_seconds": 10}},
                    "samples": [{"duration_seconds": 6, "review_status": "pending"},
                                {"duration_seconds": 6, "review_status": "pending"}]}
        report = dry_run(manifest, "a" * 64)
        self.assertFalse(report["within_budget"])
        self.assertFalse(report["live_ready"])
        self.assertEqual(report["network_requests"], 0)
        self.assertEqual(report["n_review_pending"], 2)


class CensusContextTests(unittest.TestCase):
    def test_zero_coverage_stays_null_and_no_offline_recognition_index_is_created(self):
        config = {"comparisons": [{"cohort_id": "urdu", "first_language": "Urdu"}],
                  "provider": "elevenlabs", "model_id": "scribe_v2", "settings": {},
                  "normalization_version": "en_v1"}
        manifest = {"selection_config": config, "source_hashes": {}}
        wards = [{"ward": "10", "population_language_base": "100", "ward10_corrected": "True",
                  "knows_neither_english_nor_french": "5", "home_urdu": "0", "top14_nonofficial_home_language_speakers": "0"},
                 {"ward": "2", "population_language_base": "100", "ward10_corrected": "False",
                  "knows_neither_english_nor_french": "5", "home_urdu": "10", "top14_nonofficial_home_language_speakers": "20"}]
        data = {"crosswalk": [{"language": "Urdu", "census_home_column": "home_urdu"}], "wards": wards}
        result = census_context(manifest, "a" * 64, data, "2026-11-07T00:00:00+00:00")
        self.assertEqual([w["ward"] for w in result["wards"]], [2, 10])
        positive, zero = result["wards"]
        self.assertEqual(positive["coverage_of_top14"], 0.5)
        self.assertIsNone(zero["coverage_of_top14"])
        self.assertIsNone(zero["contributions"][0]["weight"])
        self.assertTrue(zero["ward10_corrected"])
        for ward in result["wards"]:
            self.assertIsNone(ward["index"])
            self.assertEqual(ward["index_status"], "incomplete")
            self.assertIsNone(ward["run_id"])
            self.assertTrue(all(c["gap"] is None for c in ward["contributions"]))


class PendingBundleTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.manifest, self.data, self.config = synthetic_selection(self.root)
        self.manifest_hash = digest(self.manifest)
        self.run_id = "pending-" + self.manifest_hash[:16]
        with patch("lapeace_data.pilot.selection_manifest", return_value=self.manifest):
            self.output = prepare_pilot(self.root, self.data, self.config, self.root / "derived")
        self.run_dir = self.output / "runs" / self.run_id

    def validate(self):
        validate_pending_bundle(self.output, self.manifest, self.manifest_hash, self.run_id)

    def test_frozen_manifest_hash_checks_canonical_bytes_and_tampering(self):
        path = self.output / "manifest.json"
        actual, expected = read_frozen_manifest(path)
        self.assertEqual(actual, self.manifest)
        self.assertEqual(expected, self.manifest_hash)
        path.write_bytes(path.read_bytes() + b" ")
        with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
            read_frozen_manifest(path)

    def test_incomplete_existing_bundle_fails_without_silently_regenerating_it(self):
        (self.run_dir / "summary.json").unlink()
        original_results = (self.run_dir / "results.jsonl").read_bytes()
        with patch("lapeace_data.pilot.selection_manifest", return_value=self.manifest), \
             self.assertRaises(FileNotFoundError):
            prepare_pilot(self.root, self.data, self.config, self.root / "derived")
        self.assertFalse((self.run_dir / "summary.json").exists())
        self.assertEqual((self.run_dir / "results.jsonl").read_bytes(), original_results)

    def test_rerun_preserves_human_review_edits(self):
        review_path = self.output / "review_queue.csv"
        with review_path.open(newline="") as stream:
            reader = csv.DictReader(stream)
            fields, records = reader.fieldnames, list(reader)
        records[0].update({"status": "accepted", "reviewer": "Fixture reviewer",
                           "reviewed_at": "2026-11-07T12:00:00+00:00", "reason": "Synthetic test review"})
        write_csv(review_path, records, fields)
        before = review_path.read_bytes()
        with patch("lapeace_data.pilot.selection_manifest", return_value=self.manifest):
            repeated_output = prepare_pilot(self.root, self.data, self.config, self.root / "derived")
        self.assertEqual(repeated_output, self.output)
        self.assertEqual(review_path.read_bytes(), before)
        self.validate()

    def test_pending_summary_cannot_claim_measured_metrics(self):
        summary_path = self.run_dir / "summary.json"
        summary = read_json(summary_path)
        summary["cohorts"][0]["wer"] = 0
        write_json(summary_path, summary)
        with self.assertRaisesRegex(ValueError, "cohort summary"):
            self.validate()

    def test_summary_cannot_mix_a_different_settings_identity(self):
        path = self.run_dir / "summary.json"
        summary = read_json(path)
        summary["provenance"]["settings_sha256"] = "f" * 64
        write_json(path, summary)
        with self.assertRaises(ValueError):
            self.validate()

    def test_run_payload_must_match_its_declared_settings_identity(self):
        path = self.run_dir / "run.json"
        run = read_json(path)
        run["model_id"] = "different-model"
        write_json(path, run)
        with self.assertRaises(ValueError):
            self.validate()

    def test_pending_csv_cannot_contain_an_invented_prediction(self):
        path = self.run_dir / "transcripts.csv"
        with path.open(newline="") as stream:
            reader = csv.DictReader(stream)
            fields, records = reader.fieldnames, list(reader)
        records[0]["prediction_raw"] = "Invented test value that must be rejected"
        write_csv(path, records, fields)
        with self.assertRaisesRegex(ValueError, "CSV handoff"):
            self.validate()

    def test_result_sample_ids_must_match_selection(self):
        path = self.run_dir / "results.jsonl"
        records = [json.loads(line) for line in path.read_text().splitlines()]
        records[0]["sample_id"] = records[1]["sample_id"]
        path.write_bytes(b"".join(canonical_bytes(record) for record in records))
        with self.assertRaisesRegex(ValueError, "selected IDs"):
            self.validate()


if __name__ == "__main__":
    unittest.main()
