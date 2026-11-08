"""Benchmark integration checks use unique toy bytes and explicitly labelled fixtures."""

import contextlib
import copy
import csv
import io
import json
from pathlib import Path
import socket
import tempfile
import unittest
from unittest.mock import Mock, patch

from data_checks.test_offline import synthetic_selection
from lapeace_data.__main__ import main
from lapeace_data.artifacts import digest, file_hash, read_json, write_csv, write_json
from lapeace_data.benchmark import (approve_smoke, execute, exclusive, paths, plan, score_run)
from lapeace_data.elevenlabs import (ENDPOINT, ProviderFailure, multipart, transcribe_audio, transcript_text)
from lapeace_data.pilot import REVIEW_FIELDS, prepare_pilot, read_frozen_manifest
from lapeace_data.review import import_review, reviewed_manifest


class BenchmarkTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source, self.output = self.root / "source", self.root / "derived"
        self.manifest, self.data, self.config = synthetic_selection(self.source)
        for sample in self.manifest["samples"]:
            audio = self.source / sample["source_relative_path"]
            audio.write_bytes(("fixture: " + sample["sample_id"]).encode())
            sample["audio_sha256"] = file_hash(audio)
            self.manifest["candidate_audio_hashes"][sample["source_relative_path"]] = file_hash(audio)
        with patch("lapeace_data.pilot.selection_manifest", return_value=self.manifest):
            self.pilot = prepare_pilot(self.source, self.data, self.config, self.output)
        self.parent = self.pilot / "manifest.json"
        self.pointer = import_review(self.parent, self.source, self.output, reviewer="Unnamed friend (fixture)",
                                     attested_by="Fixture owner", note="Synthetic listening attestation for tests")
        self.reviewed = Path(self.pointer["manifest_path"])
        self.transport = Mock(return_value=(b'{"text":"Synthetic reference paragraph."}', "fixture-request"))

    def run_smoke(self, transport=None, **kwargs):
        p = plan(self.reviewed, self.output, origin="fixture", **kwargs)
        return execute(self.reviewed, self.output, approval=p["plan_sha256"], origin="fixture",
                       transport=transport or self.transport, **kwargs)

    def ledger(self, run):
        return Path(run["run_directory"]).parents[1] / "ledger.json"

    def test_attestation_preserves_original_and_does_not_import_buzz_predictions(self):
        self.assertEqual(file_hash(self.parent), digest(self.manifest))
        m, sha, receipt, rsha = reviewed_manifest(self.reviewed, self.output)
        self.assertEqual(receipt["basis"]["kind"], "coordinator_attestation")
        self.assertEqual(receipt["basis"]["attested_by"], "Fixture owner")
        self.assertTrue(all(s["review_status"] == "accepted" for s in m["samples"]))
        self.assertEqual([s["reference_raw"] for s in m["samples"]],
                         [s["reference_raw"] for s in self.manifest["samples"]])
        self.assertNotEqual(sha, digest(self.manifest))

    def csv_reviews(self):
        with (self.reviewed.parent / "review_queue.csv").open(newline="") as f:
            return list(csv.DictReader(f))

    def test_review_csv_correction_is_versioned_with_original_reference(self):
        records = self.csv_reviews()
        records[0].update(reference_override="Corrected fixture reference.", override_reason="Listening correction")
        path = self.root / "review.csv"
        write_csv(path, records, REVIEW_FIELDS)
        p = import_review(self.parent, self.source, self.output, review_csv=path)
        m, _ = read_frozen_manifest(p["manifest_path"])
        self.assertEqual(m["samples"][0]["reference_raw"], "Corrected fixture reference.")
        receipt = read_json(Path(p["manifest_path"]).parent / "review-receipt.json")
        self.assertEqual(receipt["source_references"][records[0]["sample_id"]], "Synthetic reference paragraph.\n")

    def test_review_rejects_pending_duplicates_missing_and_empty_corrections(self):
        for change in (lambda r:r[0].update(status="pending"), lambda r:r.pop(),
                       lambda r:r.__setitem__(0, r[1]),
                       lambda r:r[0].update(reference_override="!!!", override_reason="correction"),
                       lambda r:r[0].update(source_relative_path="../outside.mp3")):
            records = self.csv_reviews()
            change(records)
            path = self.root / "review.csv"
            write_csv(path, records, REVIEW_FIELDS)
            with self.assertRaises(ValueError):
                import_review(self.parent, self.source, self.output, review_csv=path)

    def test_review_requires_attributed_attestation(self):
        with self.assertRaises(ValueError):
            import_review(self.parent, self.source, self.output, reviewer="", attested_by="owner", note="fine")

    def test_source_and_symlink_output_protection(self):
        with self.assertRaises(ValueError):
            import_review(self.parent, self.source, self.source / "derived", reviewer="x", attested_by="y", note="z")
        alias = self.output / "alias"
        alias.symlink_to(self.reviewed.parent, target_is_directory=True)
        with self.assertRaises(ValueError):
            plan(alias / "manifest.json", self.output)

    def test_receipt_tampering_rejected(self):
        path = self.reviewed.parent / "review-receipt.json"
        value = read_json(path)
        value["reviews"][0]["reviewer"] = "changed"
        write_json(path, value)
        with self.assertRaises(ValueError):
            plan(self.reviewed, self.output)

    def test_smoke_plan_is_two_clips_no_network_or_writes(self):
        before = sorted(str(p) for p in self.output.rglob('*'))
        with patch.object(socket, "socket", side_effect=AssertionError("Network forbidden")):
            p = plan(self.reviewed, self.output)
        self.assertEqual(p["estimated_requests"], 2)
        self.assertEqual(p["network_requests"], 0)
        self.assertEqual(len(p["actions"]), 2)
        self.assertEqual(before, sorted(str(p) for p in self.output.rglob('*')))

    def test_live_requires_matching_plan_and_secure_key(self):
        p = plan(self.reviewed, self.output)
        with patch.dict("os.environ", {}, clear=True), patch("lapeace_data.benchmark.transcribe_audio") as call:
            for approval in ("", p["plan_sha256"]):
                with self.assertRaises(ValueError):
                    execute(self.reviewed, self.output, approval=approval)
            call.assert_not_called()

    def test_injected_transport_cannot_be_provider_evidence(self):
        with self.assertRaisesRegex(ValueError, "fixture"):
            execute(self.reviewed, self.output, approval="", transport=self.transport)

    def test_smoke_raw_outputs_score_and_resume_without_duplicate_requests(self):
        result = self.run_smoke()
        self.assertEqual(result["network_requests"], 2)
        scored = score_run(result["run_directory"], self.output)
        self.assertEqual(scored["summary"]["provenance"]["origin"], "fixture")
        self.assertTrue(all(r["wer"] == 0 for r in scored["results"]))
        again = self.run_smoke()
        self.assertEqual(again["network_requests"], 0)
        self.assertEqual(self.transport.call_count, 2)
        self.assertEqual(score_run(result["run_directory"], self.output, write=False), scored)

    def test_empty_prediction_is_all_deletions(self):
        run = self.run_smoke(Mock(return_value=(b'{"text":""}', "empty-fixture")))
        result = score_run(run["run_directory"], self.output)["results"][0]
        self.assertEqual((result["wer"], result["cer"]), (1, 1))
        self.assertEqual(result["status"], "succeeded")

    def test_timeout_charged_and_requires_explicit_retry(self):
        failed = Mock(side_effect=ProviderFailure("network_or_timeout"))
        run = self.run_smoke(failed)
        self.assertEqual(failed.call_count, 1)
        self.assertEqual(len(read_json(self.ledger(run))["attempts"]), 1)
        result = score_run(run["run_directory"], self.output)["results"][0]
        self.assertEqual(result["status"], "failed")
        self.assertIsNone(result["prediction_raw"])
        self.assertIsNone(result["wer"])
        p = plan(self.reviewed, self.output, origin="fixture")
        self.assertTrue(p["blocked_samples"])
        with self.assertRaises(ValueError):
            execute(self.reviewed, self.output, approval=p["plan_sha256"], origin="fixture", transport=self.transport)
        result = self.run_smoke(retry=True)
        self.assertEqual(result["network_requests"], 2)
        self.assertEqual(len(read_json(self.ledger(result))["attempts"]), 3)

    def test_unknown_delivery_reservation_is_not_silently_retried(self):
        run = self.run_smoke(Mock(side_effect=ProviderFailure("network_or_timeout")))
        ledger_path = self.ledger(run)
        ledger = read_json(ledger_path)
        ledger["attempts"][0]["status"] = "reserved"
        write_json(ledger_path, ledger)
        self.assertTrue(plan(self.reviewed, self.output, origin="fixture")["blocked_samples"])

    def test_malformed_response_preserved_and_failed(self):
        run = self.run_smoke(Mock(return_value=(b'{"not_text":"fixture"}', "bad")))
        ledger = read_json(self.ledger(run))
        self.assertEqual(ledger["attempts"][0]["error_code"], "missing_transcript_text")
        self.assertTrue((self.ledger(run).parent / "responses/1.json").exists())

    def test_corrupt_cached_response_stops_instead_of_rebilling(self):
        run = self.run_smoke()
        (self.ledger(run).parent / "responses/1.json").write_text('{"text":"tampered"}')
        with self.assertRaises(ValueError):
            self.run_smoke()
        self.assertEqual(self.transport.call_count, 2)

    def test_plan_stales_after_ledger_changes(self):
        p = plan(self.reviewed, self.output, origin="fixture")
        self.run_smoke()
        with self.assertRaises(ValueError):
            execute(self.reviewed, self.output, approval=p["plan_sha256"], origin="fixture", transport=self.transport)

    def test_full_gate_then_cache_smoke_and_submit_only_remaining_38(self):
        p = plan(self.reviewed, self.output, phase="full", origin="fixture")
        self.assertFalse(p["smoke_approved"])
        with self.assertRaises(ValueError):
            execute(self.reviewed, self.output, approval=p["plan_sha256"], phase="full",
                    origin="fixture", transport=self.transport)
        smoke = self.run_smoke()
        approve_smoke(smoke["run_directory"], self.output, "Fixture operator")
        p = plan(self.reviewed, self.output, phase="full", origin="fixture")
        self.assertEqual(p["estimated_requests"], 38)
        run = execute(self.reviewed, self.output, approval=p["plan_sha256"], phase="full",
                      origin="fixture", transport=self.transport)
        scored = score_run(run["run_directory"], self.output)
        self.assertEqual(len(scored["results"]), 40)
        self.assertTrue(all(c["n_succeeded"] == 10 for c in scored["summary"]["cohorts"]))
        self.assertEqual(self.transport.call_count, 40)

    def test_fixture_smoke_cannot_approve_provider_full_run(self):
        smoke = self.run_smoke()
        approve_smoke(smoke["run_directory"], self.output, "Fixture operator")
        self.assertFalse(plan(self.reviewed, self.output, phase="full")["smoke_approved"])

    def test_failed_smoke_cannot_be_approved(self):
        smoke = self.run_smoke(Mock(side_effect=ProviderFailure("http_401")))
        with self.assertRaises(ValueError):
            approve_smoke(smoke["run_directory"], self.output, "Fixture operator")

    def test_budget_caps_attempts_and_audio_before_submission(self):
        smoke = self.run_smoke()
        path = self.ledger(smoke)
        original = read_json(path)
        for count, duration in ((45, 1), (2, 900)):
            ledger = copy.deepcopy(original)
            ledger["attempts"] = [{**original["attempts"][0], "number": i+1, "status": "failed",
                                    "duration_seconds": duration, "cache_key": "unrelated-fixture-key"}
                                   for i in range(count)]
            write_json(path, ledger)
            p = plan(self.reviewed, self.output, origin="fixture")
            self.assertFalse(p["within_budget"])
            with self.assertRaises(ValueError):
                execute(self.reviewed, self.output, approval=p["plan_sha256"], origin="fixture", transport=self.transport)
        self.assertEqual(self.transport.call_count, 2)

    def test_concurrent_operator_lock_rejects_second_operator(self):
        m, sha, _, rsha = reviewed_manifest(self.reviewed, self.output)
        folder, _, _ = paths(m, sha, rsha, "smoke", self.output, "fixture")
        with exclusive(folder), self.assertRaises(ValueError):
            self.run_smoke()

    def test_scoring_rejects_mixed_settings_and_attempt_ids(self):
        run = self.run_smoke()
        path = Path(run["run_directory"]) / "run.json"
        original = read_json(path)
        for change in (lambda r:r.update(model_id="other"), lambda r:r["attempts"].update({"unknown": 1}),
                       lambda r:r["attempts"].update({next(iter(r["attempts"])): 999})):
            record = copy.deepcopy(original)
            change(record)
            write_json(path, record)
            with self.assertRaises(ValueError):
                score_run(path.parent, self.output)

    def test_cli_dry_run_defaults_and_unreviewed_live_rejection(self):
        stdout, stderr = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr), \
             patch.object(socket, "socket", side_effect=AssertionError("Network forbidden")):
            self.assertEqual(main(["transcribe", "--manifest", str(self.reviewed), "--output-dir", str(self.output)]), 0)
            self.assertEqual(main(["transcribe", "--manifest", str(self.parent), "--live"]), 1)
        self.assertIn('"estimated_requests": 2', stdout.getvalue())


class TransportTests(unittest.TestCase):
    def test_exact_multipart_settings_and_no_reference_prompt(self):
        body, content_type = multipart(b'fixture audio', "scribe_v2", {
            "language_code": "en", "diarize": False, "tag_audio_events": False, "no_verbatim": False})
        self.assertIn(b'name="language_code"\r\n\r\nen', body)
        self.assertIn(b'name="no_verbatim"\r\n\r\nfalse', body)
        self.assertIn(b'fixture audio', body)
        self.assertNotIn(b'keyterms', body)
        self.assertTrue(content_type.startswith('multipart/form-data; boundary='))

    def test_http_adapter_uses_fixed_https_endpoint_and_returns_raw_bytes(self):
        response = Mock()
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        response.read.return_value = b'{"text":"fixture"}'
        response.headers = {"request-id": "fixture-id"}
        opener = Mock()
        opener.open.return_value = response
        with patch("lapeace_data.elevenlabs.build_opener", return_value=opener):
            raw, ident = transcribe_audio(b'fixture', "scribe_v2", {"language_code":"en"}, "fixture-secret")
        request = opener.open.call_args.args[0]
        self.assertEqual(request.full_url, ENDPOINT)
        self.assertEqual(request.headers['Xi-api-key'], 'fixture-secret')
        self.assertEqual((raw,ident), (b'{"text":"fixture"}', 'fixture-id'))
        self.assertEqual(opener.open.call_count, 1)

    def test_invalid_response_text_rejected_but_empty_string_valid(self):
        for raw in (b'bad json', b'[]', b'{"text":null}'):
            with self.assertRaises(ProviderFailure):transcript_text(raw)
        self.assertEqual(transcript_text(b'{"text":""}'), '')
