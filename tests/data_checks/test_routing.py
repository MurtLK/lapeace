"""Routing checks use labelled toy text and fake FLAC bytes, never provider or voice findings."""

import contextlib
import copy
import csv
import io
from pathlib import Path
import socket
import tempfile
import unittest
from unittest.mock import patch

from lapeace_data.__main__ import main
from lapeace_data.artifacts import PROJECT_ROOT, digest, file_hash, read_json, write_csv, write_json
from lapeace_data.routing import (DIVISIONS, INTENTS, LOCALES, MASSIVE, META, MINDS, PREDICTION_FIELDS, TYPES,
                                  ExampleRouter, config_at, intent_metrics, prepare_routing, score_routing, split_records)
from lapeace_data.routing import import_routing_buzz


class RoutingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source, self.output = self.root / "source", self.root / "derived"
        self.source.mkdir()
        for name in ("README.md", "DATA_DICTIONARY.md", "LICENSES.md"):
            (self.source / name).write_text("Synthetic routing fixture; not real speech or findings.")
        self.metadata = []
        for locale, language in LOCALES.items():
            for intent in INTENTS:
                for j in range(6):
                    name = f"audio/{locale}/{intent}-{j}.flac"
                    target = self.source / MINDS / name
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(b"fLaC" + name.encode())
                    self.metadata.append({"file": name, "locale": locale, "language": language, "intent": intent,
                                          "transcription": f"Synthetic request {intent.replace('_', '')} variant {j}",
                                          "english_transcription": "translation_leak_marker"})
        self.save_metadata()
        write_csv(self.source / TYPES, [{"division": "fixture waste", "section": "fixture", "service_request_type": "fixture bin", "requests_2025": 7}],
                  ["division", "section", "service_request_type", "requests_2025"])
        write_csv(self.source / DIVISIONS, [{"ward": "fixture ward", "division": "fixture waste", "requests_2025": 7}], ["ward", "division", "requests_2025"])
        write_csv(self.source / MASSIVE, [{"locale": "fixture", "scenario": "fixture", "intent": "fixture", "speaker_id": "fixture"}], ["locale", "scenario", "intent", "speaker_id"])
        self.config_path = PROJECT_ROOT / "config/routing.json"
        self.inspection = patch("lapeace_data.routing.inspect_media", return_value={"duration_seconds": 2., "channels": 1, "sample_rate_hz": 8000, "decode_status": "passed"})
        self.inspection.start()
        self.addCleanup(self.inspection.stop)

    def save_metadata(self):
        write_csv(self.source / META, self.metadata, list(self.metadata[0]))

    def prepare(self):
        with patch.object(socket, "socket", side_effect=AssertionError("Network forbidden")):
            return prepare_routing(self.source, self.output, self.config_path, origin="fixture")

    def imported_rows(self, manifest):
        return [{"sample_id": r["sample_id"], "audio_sha256": r["audio_sha256"], "status": "succeeded",
                 "transcript": r["reference_raw"], "model_id": "fixture-only", "settings_sha256": digest({"fixture": r["locale"]})}
                for r in manifest["records"] if r["sample_id"] in manifest["audio_pilot_ids"]]

    def test_freezes_reproducible_splits_and_unpaid_audio_plan(self):
        first = self.prepare()
        second = self.prepare()
        self.assertEqual(first, second)
        folder = Path(first["pilot_directory"])
        manifest = read_json(folder / "manifest.json")
        self.assertEqual(manifest["origin"], "fixture")
        self.assertTrue(all("english_transcription" not in r for r in manifest["records"]))
        train = [r for r in manifest["records"] if r["split"] == "train"]
        test = [r for r in manifest["records"] if r["split"] == "test"]
        self.assertFalse({r["group_id"] for r in train} & {r["group_id"] for r in test})
        self.assertFalse({r["audio_sha256"] for r in train} & {r["audio_sha256"] for r in test})
        self.assertEqual(first["audio_pilot_clips"], 40)
        self.assertEqual(first["audio_pilot_seconds"], 80)
        self.assertFalse(read_json(folder / "audio-plan.json")["live_authorized"])
        self.assertEqual(split_records(list(reversed(manifest["records"])), manifest["config"]), manifest["records"])

    def test_duplicate_text_audio_and_conflicting_labels_are_not_leaked(self):
        self.metadata[1]["transcription"] = self.metadata[0]["transcription"]
        self.metadata[2]["transcription"] = self.metadata[6]["transcription"]  # Cross-intent conflict.
        self.save_metadata()
        report = self.prepare()
        records = read_json(Path(report["pilot_directory"]) / "manifest.json")["records"]
        reasons = [r["exclusion_reason"] for r in records if r["split"] == "excluded"]
        self.assertIn("duplicate_text_or_audio", reasons)
        self.assertEqual(reasons.count("conflicting_label_or_locale"), 2)
        self.assertEqual(len(records), len(self.metadata))

    def test_router_fits_only_training_vocabulary_and_abstains_without_evidence(self):
        config = config_at(self.config_path)
        train = [{"reference_raw": "red apple fruit", "intent": "balance", "sample_id": "fixture-a"},
                 {"reference_raw": "blue ocean waves", "intent": "freeze", "sample_id": "fixture-b"}]
        model = ExampleRouter(train, config)
        self.assertEqual(model.predict("red apple fruit")["predicted_intent"], "balance")
        self.assertIsNone(model.predict("")["predicted_intent"])
        self.assertEqual(model.predict("宇宙銀河星")["decision"], "clarify")
        before = dict(model.idf)
        model.predict("uniquetestword")
        self.assertEqual(before, model.idf)
        tie = ExampleRouter([dict(train[0]), {**train[0], "intent": "freeze", "sample_id": "fixture-c"}], config)
        self.assertEqual(tie.predict("red apple fruit")["decision"], "clarify")

    def test_reference_score_and_imported_stt_are_separate_with_failures_counted(self):
        prepared = self.prepare()
        folder = Path(prepared["pilot_directory"])
        with patch.object(socket, "socket", side_effect=AssertionError("Network forbidden")):
            reference = score_routing(folder, self.output)
            self.assertEqual(reference, score_routing(folder, self.output))
        self.assertEqual(reference["mode"], "reference_text_baseline")
        self.assertEqual(reference["evaluated_requests"], 140)
        self.assertEqual(reference["summary"]["origin"], "fixture")
        self.assertEqual(reference["summary"]["network_requests"], 0)
        m = read_json(folder / "manifest.json")
        prediction_rows = self.imported_rows(m)
        prediction_rows[0].update(status="failed", transcript="")
        prediction_rows[1]["transcript"] = ""
        path = self.root / "predictions.csv"
        write_csv(path, prediction_rows, PREDICTION_FIELDS)
        with patch.object(socket, "socket", side_effect=AssertionError("Network forbidden")):
            asr = score_routing(folder, self.output, path)
        self.assertNotEqual(asr["run_id"], reference["run_id"])
        self.assertEqual(asr["evaluated_requests"], 40)
        self.assertEqual(asr["mode"], "external_stt_routing")
        self.assertEqual(asr["summary"]["overall"]["provider_failed"], 1)
        self.assertGreaterEqual(asr["summary"]["overall"]["clarify"], 1)
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(main(["routed-score", "--pilot-dir", str(folder), "--output-dir", str(self.output)]), 0)

    def test_routing_metrics_distinguish_wrong_route_abstention_and_provider_failure(self):
        results = [{"expected_intent": "balance", "predicted_intent": "balance", "decision": "route"},
                   {"expected_intent": "balance", "predicted_intent": "freeze", "decision": "route"},
                   {"expected_intent": "freeze", "predicted_intent": None, "decision": "clarify"},
                   {"expected_intent": "freeze", "predicted_intent": None, "decision": "provider_failure"}]
        m = intent_metrics(results)
        self.assertEqual((m["accuracy"], m["routing_coverage"], m["accuracy_when_routed"]), (.25, .5, .5))
        self.assertEqual((m["wrong_route"], m["clarify"], m["provider_failed"]), (1, 1, 1))
        self.assertEqual(m["confusion"]["freeze"]["__provider_failure__"], 1)

    def test_invalid_source_and_source_output_are_rejected(self):
        with self.assertRaises(ValueError):
            prepare_routing(self.source, self.source / "output", self.config_path, origin="fixture")
        self.metadata[0]["file"] = "../outside.flac"
        self.save_metadata()
        with self.assertRaises(ValueError):
            self.prepare()

    def test_changed_source_and_manifest_are_rejected(self):
        folder = Path(self.prepare()["pilot_directory"])
        source = self.source / MINDS / self.metadata[0]["file"]
        before = source.read_bytes()
        source.write_bytes(b"fLaCchanged")
        with self.assertRaises(ValueError):
            score_routing(folder, self.output)
        source.write_bytes(before)
        manifest = read_json(folder / "manifest.json")
        manifest["records"][0]["intent"] = "freeze" if manifest["records"][0]["intent"] != "freeze" else "balance"
        write_json(folder / "manifest.json", manifest)
        with self.assertRaises(ValueError):
            score_routing(folder, self.output)

    def test_pending_missing_duplicate_and_mismatched_stt_are_rejected(self):
        folder = Path(self.prepare()["pilot_directory"])
        original = self.imported_rows(read_json(folder / "manifest.json"))
        path = self.root / "predictions.csv"
        changes = (lambda r:r[0].update(status="pending"), lambda r:r.pop(), lambda r:r.append(r[0]),
                   lambda r:r[0].update(audio_sha256="0"*64), lambda r:r[0].update(model_id="another-model"),
                   lambda r:r[0].update(settings_sha256="invalid"), lambda r:r[0].update(settings_sha256="f"*64))
        for change in changes:
            copied = copy.deepcopy(original)
            change(copied)
            write_csv(path, copied, PREDICTION_FIELDS)
            with self.assertRaises(ValueError):
                score_routing(folder, self.output, path)

    def test_toronto_aggregate_mismatch_rejected(self):
        write_csv(self.source / DIVISIONS, [{"ward": "fixture", "division": "fixture waste", "requests_2025": 8}], ["ward", "division", "requests_2025"])
        with self.assertRaises(ValueError):
            self.prepare()

    def test_audio_shared_across_locales_is_excluded_from_both(self):
        first = self.source / MINDS / self.metadata[0]["file"]
        other_row = next(r for r in self.metadata if r["locale"] == "pl-PL" and r["intent"] == self.metadata[0]["intent"])
        second = self.source / MINDS / other_row["file"]
        second.write_bytes(first.read_bytes())
        folder = Path(self.prepare()["pilot_directory"])
        records = read_json(folder / "manifest.json")["records"]
        excluded = [r for r in records if r["exclusion_reason"] == "conflicting_label_or_locale"]
        self.assertEqual(len(excluded), 2)

    def test_buzz_import_preserves_raw_exports_and_pairs_identical_examples(self):
        folder = Path(self.prepare()["pilot_directory"])
        m = read_json(folder / "manifest.json")
        exports = self.root / "exports"
        exports.mkdir()
        for row in m["records"]:
            if row["sample_id"] in m["audio_pilot_ids"]:
                (exports / (row["sample_id"].replace(":", "_") + " (transcribed on fixture).txt")).write_text(row["reference_raw"])
        settings = self.root / "settings.json"
        write_json(settings, {"model": "fixture-only", "language": None})
        with patch.object(socket, "socket", side_effect=AssertionError("Network forbidden")):
            result = import_routing_buzz(folder, exports, "fixture-only", settings, self.output)
        self.assertEqual(result["evaluated_requests"], 40)
        self.assertEqual(result["summary"]["overall"], result["summary"]["reference_overall_same_examples"])
        self.assertNotIn("reference_correct_stt_wrong", result["summary"]["paired_outcomes"])
        self.assertEqual(len(list((Path(result["buzz_import_directory"]) / "inputs").glob('*.txt'))), 40)
        first = next(exports.glob('*.txt'))
        duplicate = exports / (first.name.split(' (transcribed on ')[0]+'.txt')
        duplicate.write_text('duplicate fixture')
        with self.assertRaises(ValueError):
            import_routing_buzz(folder, exports, "fixture-only", settings, self.output)


if __name__ == "__main__":
    unittest.main()
