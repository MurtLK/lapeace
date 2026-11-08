"""Reviewed, budgeted benchmark jobs and reproducible scoring from saved raw responses."""

from contextlib import contextmanager
import fcntl
import hashlib
import json
import math
import os
from pathlib import Path

from .artifacts import (SCHEMA_VERSION, atomic_write, canonical_bytes, check, code_state,
                        digest, file_hash, read_json, write_csv, write_json)
from .dataset import contained_file
from .elevenlabs import ProviderFailure, transcribe_audio, transcript_text
from .metrics import aggregate, score
from .pilot import TRANSCRIPT_FIELDS
from .review import managed, reviewed_manifest, utc_now


@contextmanager
def exclusive(folder):
    folder.mkdir(parents=True, exist_ok=True)
    if (folder / "operator.lock").is_symlink():
        raise ValueError("Operator lock cannot be a symlink")
    with (folder / "operator.lock").open("a") as stream:
        try:
            fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise ValueError("Another benchmark operator holds this selection's lock") from None
        try:
            yield
        finally:
            fcntl.flock(stream, fcntl.LOCK_UN)


def identity(manifest, manifest_hash, review_hash, phase, origin):
    if phase not in ("smoke", "full") or origin not in ("provider", "fixture"):
        raise ValueError("Unknown phase or evidence origin")
    config = manifest["selection_config"]
    settings = {k: config[k] for k in ("provider", "model_id", "settings")}
    selection = digest([(s["sample_id"], s["audio_sha256"]) for s in manifest["samples"]])
    run_id = "run-" + digest({"manifest": manifest_hash, "review": review_hash,
                             "settings": settings, "phase": phase, "origin": origin})[:24]
    return selection, digest(settings), run_id


def selected_samples(manifest, phase):
    if phase == "full":
        return manifest["samples"]
    baseline = manifest["selection_config"]["baseline"]["cohort_id"]
    comparison = manifest["selection_config"]["comparisons"][0]["cohort_id"]
    return [next(s for s in manifest["samples"] if s["cohort_id"] == c) for c in (baseline, comparison)]


def cache_key(sample, config):
    return digest({"audio_sha256": sample["audio_sha256"],
                   **{k: config[k] for k in ("provider", "model_id", "settings")}})


def paths(manifest, sha, review_sha, phase, output, origin):
    selection, settings, run_id = identity(manifest, sha, review_sha, phase, origin)
    folder = managed(Path(output) / "benchmark" / origin / selection, output)
    return folder, managed(folder / "runs" / run_id, output), settings


def ledger_at(folder, selection, origin):
    path = folder / "ledger.json"
    if path.is_symlink():
        raise ValueError("Ledger cannot be a symlink")
    value = read_json(path) if path.exists() else {
        "schema_version": SCHEMA_VERSION, "selection_sha256": selection, "origin": origin, "attempts": []}
    if value["selection_sha256"] != selection or value["origin"] != origin:
        raise ValueError("Ledger identity mismatch")
    attempts = value["attempts"]
    if [a["number"] for a in attempts] != list(range(1, len(attempts) + 1)):
        raise ValueError("Invalid attempt ledger numbering")
    if any(a["status"] not in ("reserved", "succeeded", "failed")
           or not math.isfinite(a["duration_seconds"]) or a["duration_seconds"] <= 0
           or a["origin"] != origin for a in attempts):
        raise ValueError("Invalid attempt ledger")
    return value


def raw_text(folder, attempt):
    path = contained_file(folder, f"responses/{attempt['number']}.json")
    if file_hash(path) != attempt["raw_sha256"]:
        raise ValueError("Saved provider response changed")
    return transcript_text(path.read_bytes())


def plan(manifest_path, output, *, phase="smoke", retry=False, origin="provider"):
    manifest, sha, receipt, review_sha = reviewed_manifest(manifest_path, output)
    config = manifest["selection_config"]
    folder, run_dir, settings = paths(manifest, sha, review_sha, phase, output, origin)
    selection = folder.name
    ledger = ledger_at(folder, selection, origin)
    selected = selected_samples(manifest, phase)
    actions = []
    for sample in selected:
        if file_hash(contained_file(receipt["dataset_root"], sample["source_relative_path"])) != sample["audio_sha256"]:
            raise ValueError("Audio differs from reviewed manifest")
        key = cache_key(sample, config)
        previous = [a for a in ledger["attempts"] if a["cache_key"] == key]
        success = next((a for a in reversed(previous) if a["status"] == "succeeded"), None)
        if success:
            if success["audio_sha256"] != sample["audio_sha256"] or success["settings_sha256"] != settings:
                raise ValueError("Cache metadata differs from its identity")
            raw_text(folder, success)  # A bad cache is an error, never a paid miss.
        actions.append({"sample_id": sample["sample_id"], "cache_key": key,
                        "duration_seconds": sample["duration_seconds"],
                        "action": "cached" if success else "blocked" if previous and not retry else "submit",
                        "attempt": success["number"] if success else None})
    attempts = sum(a["action"] == "submit" for a in actions)
    seconds = sum(a["duration_seconds"] for a in actions if a["action"] == "submit")
    used_seconds = sum(a["duration_seconds"] for a in ledger["attempts"])
    cap = config["budget"]
    smoke_ok = True
    if phase == "full":
        _, smoke_dir, _ = paths(manifest, sha, review_sha, "smoke", output, origin)
        approval = smoke_dir / "smoke-approval.json"
        smoke_ok = False
        if approval.exists():
            approved = read_json(approval)
            smoke_run = read_json(smoke_dir / "run.json")
            scored = score_run(smoke_dir, output, write=False)
            smoke_ok = (approved["run_sha256"] == digest(smoke_run)
                        and approved["scores_sha256"] == digest(scored)
                        and all(r["status"] == "succeeded" for r in scored["results"]))
    value = {"schema_version": SCHEMA_VERSION, "mode": "dry_run", "network_requests": 0,
             "manifest_path": str(Path(manifest_path).resolve()), "manifest_sha256": sha,
             "review_sha256": review_sha, "settings_sha256": settings, "phase": phase, "origin": origin,
             "run_directory": str(run_dir), "actions": actions, "retry": retry,
             "estimated_requests": attempts, "estimated_audio_seconds": round(seconds, 6),
             "attempts_already_reserved": len(ledger["attempts"]), "budget": cap,
             "audio_seconds_already_reserved": used_seconds, "smoke_approved": smoke_ok,
             "within_budget": len(ledger["attempts"]) + attempts <= cap["max_attempts"]
             and used_seconds + seconds <= cap["max_submitted_audio_seconds"],
             "blocked_samples": [a["sample_id"] for a in actions if a["action"] == "blocked"]}
    value["plan_sha256"] = digest(value)
    return value


def execute(manifest_path, output, *, approval, phase="smoke", retry=False,
            transport=None, origin="provider"):
    if transport is not None and origin != "fixture":
        raise ValueError("Injected transports must use origin=fixture")
    if transport is None and origin != "provider":
        raise ValueError("Fixtures cannot call the provider")
    manifest, sha, receipt, review_sha = reviewed_manifest(manifest_path, output)
    folder, run_dir, settings_sha = paths(manifest, sha, review_sha, phase, output, origin)
    managed(folder / "responses" / "preflight.json", output)
    with exclusive(folder):
        current = plan(manifest_path, output, phase=phase, retry=retry, origin=origin)
        if current["plan_sha256"] != approval:
            raise ValueError("Approval must match the current dry-run plan SHA-256")
        if not current["within_budget"] or current["blocked_samples"] or not current["smoke_approved"]:
            raise ValueError("Budget, unresolved attempts, or smoke-approval gate prevents this run")
        api_key = os.environ.get("ELEVENLABS_API_KEY", "") if origin == "provider" else "fixture"
        if current["estimated_requests"] and not api_key.strip():
            raise ValueError("Configure ELEVENLABS_API_KEY securely before live mode")
        transport = transport or transcribe_audio
        ledger = ledger_at(folder, folder.name, origin)
        config = manifest["selection_config"]
        run_dir.mkdir(parents=True, exist_ok=True)
        record_path = run_dir / "run.json"
        run = read_json(record_path) if record_path.exists() else {
            "schema_version": SCHEMA_VERSION, "run_id": run_dir.name,
            "manifest_path": str(Path(manifest_path).resolve()), "manifest_sha256": sha,
            "review_sha256": review_sha, "selection_sha256": folder.name,
            "settings_sha256": settings_sha, "provider": config["provider"], "model_id": config["model_id"],
            "settings": config["settings"], "normalization_version": config["normalization_version"],
            "phase": phase, "origin": origin, "created_at": utc_now(), "code": code_state(), "attempts": {},
            "status": "pending", "evidence_status": "unmeasured", "request_count": 0,
            "submitted_audio_seconds": 0}
        check(run, "BenchmarkRun")
        if record_path.exists():
            score_run(run_dir, output, write=False)  # Validate existing references before any new paid work.
        if (run["manifest_sha256"], run["review_sha256"], run["settings_sha256"], run["phase"], run["origin"]) != (
                sha, review_sha, settings_sha, phase, origin):
            raise ValueError("Existing run identity differs")
        by_id = {s["sample_id"]: s for s in manifest["samples"]}
        actual_requests = 0
        for action in current["actions"]:
            ident = action["sample_id"]
            if action["action"] == "cached":
                run["attempts"][ident] = action["attempt"]
                write_json(record_path, run, "BenchmarkRun")
                continue
            sample = by_id[ident]
            audio = contained_file(receipt["dataset_root"], sample["source_relative_path"]).read_bytes()
            if hashlib.sha256(audio).hexdigest() != sample["audio_sha256"]:
                raise ValueError("Audio changed before submission")
            attempt = {"number": len(ledger["attempts"]) + 1, "sample_id": ident,
                       "cache_key": action["cache_key"], "audio_sha256": sample["audio_sha256"],
                       "settings_sha256": settings_sha, "origin": origin,
                       "duration_seconds": sample["duration_seconds"], "reserved_at": utc_now(),
                       "status": "reserved", "request_id": None, "error_code": None}
            ledger["attempts"].append(attempt)
            # Reserve before network delivery. A killed process/timeout remains charged.
            write_json(folder / "ledger.json", ledger)
            run["attempts"][ident] = attempt["number"]
            run["status"] = "running"
            write_json(record_path, run, "BenchmarkRun")
            actual_requests += 1
            try:
                raw, request_id = transport(audio, config["model_id"], config["settings"], api_key)
                raw_path = managed(folder / "responses" / f"{attempt['number']}.json", output)
                atomic_write(raw_path, raw)
                attempt["raw_sha256"] = file_hash(raw_path)
                attempt["request_id"] = request_id
                transcript_text(raw)
                attempt["status"] = "succeeded"
            except ProviderFailure as error:
                attempt["status"], attempt["error_code"] = "failed", error.code
            except Exception:
                # Unknown transport exceptions can contain credentials; store only a fixed code.
                attempt["status"], attempt["error_code"] = "failed", "transport_failure"
            attempt["completed_at"] = utc_now()
            write_json(folder / "ledger.json", ledger)
            if attempt["status"] != "succeeded":
                break  # No paid retry or continuation after a provider failure.
        chosen = [ledger["attempts"][n - 1] for n in run["attempts"].values()]
        done = sum(a["status"] == "succeeded" for a in chosen)
        run.update(status="complete" if done == len(current["actions"]) else "partial" if done else "failed",
                   evidence_status=("fixture" if origin == "fixture" else "measured" if phase == "full"
                                    and done == 40 else "partial" if done else "unmeasured"),
                   request_count=len(ledger["attempts"]),
                   submitted_audio_seconds=sum(a["duration_seconds"] for a in ledger["attempts"]))
        write_json(record_path, run, "BenchmarkRun")
        return {"run_directory": str(run_dir), "status": run["status"], "network_requests": actual_requests,
                "origin": origin}


def score_run(run_dir, output, *, write=True):
    run_dir = managed(run_dir, output)
    if write:
        existing = read_json(run_dir / "run.json")
        check(existing, "BenchmarkRun")
        reviewed_manifest(existing["manifest_path"], output)  # Protect source before creating a lock.
        with exclusive(run_dir.parents[1]):
            payload = score_run(run_dir, output, write=False)
            atomic_write(run_dir / "results.jsonl", b"".join(canonical_bytes(r) for r in payload["results"]))
            write_json(run_dir / "summary.json", payload["summary"], "Summary")
            run = read_json(run_dir / "run.json")
            manifest, _, _, _ = reviewed_manifest(run["manifest_path"], output)
            indexed = {s["sample_id"]: s for s in manifest["samples"]}
            write_csv(run_dir / "transcripts.csv", [{**indexed[r["sample_id"]], **r}
                      for r in payload["results"]], TRANSCRIPT_FIELDS)
            return payload
    run = read_json(run_dir / "run.json")
    check(run, "BenchmarkRun")
    manifest, sha, receipt, review_sha = reviewed_manifest(run["manifest_path"], output)
    folder, expected_run_dir, settings = paths(manifest, sha, review_sha, run["phase"], output, run["origin"])
    if (run_dir != expected_run_dir or run["run_id"] != run_dir.name or run["selection_sha256"] != folder.name
            or run["manifest_sha256"] != sha or run["review_sha256"] != review_sha
            or run["settings_sha256"] != settings
            or any(run[k] != manifest["selection_config"][k] for k in
                   ("provider", "model_id", "settings", "normalization_version"))):
        raise ValueError("Run/manifest/settings identity mismatch")
    ledger = ledger_at(folder, folder.name, run["origin"])
    selected = selected_samples(manifest, run["phase"])
    if not set(run["attempts"]).issubset({s["sample_id"] for s in selected}):
        raise ValueError("Run contains unexpected sample IDs")
    results = []
    for sample in selected:
        result = {"schema_version": SCHEMA_VERSION, "sample_id": sample["sample_id"], "run_id": run["run_id"],
                  "status": "pending", **{k: None for k in ("prediction_raw", "provider_request_id", "completed_at",
                  "error_code", "word_edits", "reference_words", "character_edits", "reference_characters", "wer", "cer")}}
        number = run["attempts"].get(sample["sample_id"])
        if number is not None:
            if type(number) is not int or not 1 <= number <= len(ledger["attempts"]):
                raise ValueError("Run references an invalid attempt")
            attempt = ledger["attempts"][number - 1]
            if (attempt["cache_key"] != cache_key(sample, manifest["selection_config"])
                    or attempt["settings_sha256"] != settings or attempt["audio_sha256"] != sample["audio_sha256"]):
                raise ValueError("Attempt differs from this sample and settings")
            result.update(status="failed", error_code=attempt["error_code"] or "interrupted_or_unknown",
                          completed_at=attempt.get("completed_at"), provider_request_id=attempt["request_id"])
            if attempt["status"] == "succeeded":
                text = raw_text(folder, attempt)
                result.update(status="succeeded", prediction_raw=text, error_code=None,
                              **score(sample["reference_raw"], text))
        check(result, "TranscriptResult")
        results.append(result)
    cohorts = []
    for cohort in manifest["cohorts"]:
        ids = {s["sample_id"] for s in selected if s["cohort_id"] == cohort["cohort_id"]}
        cohorts.append({"cohort_id": cohort["cohort_id"], "first_language": cohort["first_language"],
                        "spoken_language": "en", **aggregate([r for r in results if r["sample_id"] in ids]),
                        "delta_wer_from_baseline": None})
    baseline = next(c for c in cohorts if c["cohort_id"] == manifest["selection_config"]["baseline"]["cohort_id"])
    for cohort in cohorts:
        if cohort["wer"] is not None and baseline["wer"] is not None:
            cohort["delta_wer_from_baseline"] = cohort["wer"] - baseline["wer"]
    summary = {"schema_version": SCHEMA_VERSION, "artifact_type": "summary", "run_id": run["run_id"],
               "cohorts": cohorts, "provenance": {"artifact_id": run["run_id"],
               "source_hashes": manifest["source_hashes"], "manifest_sha256": sha,
               "settings_sha256": settings, "normalization_version": run["normalization_version"],
               "generated_at": run["created_at"], "origin": run["origin"],
               "limitations": [x for x in manifest["limitations"] if "Offline preparation contains" not in x]
               + (["Smoke results cover two clips only; no ward ranking is approved."] if run["phase"] == "smoke"
                  else ["Ward ranking and demo promotion require a separate reviewed export."]),
               "attribution": manifest["attribution"]}}
    check(summary, "Summary")
    payload = {"results": results, "summary": summary}
    return payload


def approve_smoke(run_dir, output, operator):
    run_dir = managed(run_dir, output)
    if not operator.strip():
        raise ValueError("A named smoke reviewer is required")
    run = read_json(run_dir / "run.json")
    if run["phase"] != "smoke":
        raise ValueError("Only a two-clip smoke run can be approved")
    scored = score_run(run_dir, output, write=False)
    if len(scored["results"]) != 2 or any(r["status"] != "succeeded" for r in scored["results"]):
        raise ValueError("Both smoke clips must succeed before approval")
    approval = {"operator": operator, "approved_at": utc_now(), "run_sha256": digest(run),
                "scores_sha256": digest(scored), "meaning": "Operator inspected raw outputs and scoring"}
    write_json(run_dir / "smoke-approval.json", approval)
    return approval
