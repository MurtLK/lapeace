"""Offline evaluation of preserved Buzz predictions against human-reviewed references."""

import csv
import hashlib
import io
from pathlib import Path

from .artifacts import (SCHEMA_VERSION, atomic_write, canonical_bytes, check, code_state,
                        digest, file_hash, read_json, write_csv, write_json)
from .benchmark import exclusive
from .dataset import REQUIRED, contained_file, validate_dataset
from .metrics import aggregate, normalize, score
from .pilot import (REVIEW_FIELDS, TRANSCRIPT_FIELDS, read_frozen_manifest,
                    validate_pending_bundle)
from .review import import_review, managed, protect_source, reviewed_manifest, utc_now
from .wards import recognition_context


def verified_dataset(root, manifest):
    archives = {k: v for k, v in manifest["source_hashes"].items() if k not in REQUIRED}
    data = validate_dataset(root, archives)
    if (data["source_hashes"] != manifest["source_hashes"] or
            data["audio_hashes"] != manifest["candidate_audio_hashes"]):
        raise ValueError("Dataset differs from the frozen selection")
    return data


def corrected_references(raw, metadata, samples):
    """The transcript column is a human reference only after explicit operator attestation."""
    reader = csv.DictReader(io.StringIO(raw.decode("utf-8-sig"), newline=""))
    fields = reader.fieldnames or []
    if len(set(fields)) != len(fields) or not {"audio_file", "speaker_group", "transcript"} <= set(fields):
        raise ValueError("Reference CSV needs unique audio_file, speaker_group and transcript headers")
    known = {Path(r["file"]).name: r["language"] for r in metadata}
    refs = {}
    for row in reader:
        if None in row or any(v is None for v in row.values()):
            raise ValueError("Incomplete reference CSV row")
        name = row["audio_file"]
        if name not in known or name in refs or name != Path(name).name:
            raise ValueError("Unknown or duplicate reference audio_file")
        if row["speaker_group"] != known[name] or not normalize(row["transcript"]):
            raise ValueError("Reference speaker group mismatch or empty normalized reference")
        refs[name] = row["transcript"]
    if any(Path(s["source_relative_path"]).name not in refs for s in samples):
        raise ValueError("Reference CSV must cover all 40 selected clips")
    return refs


def snapshot(path, raw, output):
    path = managed(path, output)
    if path.exists() and path.read_bytes() != raw:
        raise ValueError("Stored import input changed; refusing overwrite")
    atomic_write(path, raw)


def import_buzz(manifest_path, dataset_root, references_csv, buzz_dir, output, *,
                reviewer, attested_by, uniform_settings=False, origin="provider"):
    """Import actual existing text; this function never loads credentials or submits audio."""
    if origin not in ("provider", "fixture"):
        raise ValueError("Unknown evidence origin")
    if not all(isinstance(x, str) and x.strip() for x in (reviewer, attested_by)):
        raise ValueError("Corrected references require reviewer and coordinator attribution")
    output, dataset_root, buzz_dir = Path(output).resolve(), Path(dataset_root).resolve(), Path(buzz_dir).resolve()
    protect_source(output, dataset_root)
    parent_path = managed(manifest_path, output)
    parent, parent_hash = read_frozen_manifest(parent_path)
    validate_pending_bundle(parent_path.parent, parent, parent_hash, "pending-" + parent_hash[:16])
    data = verified_dataset(dataset_root, parent)
    raw_csv = Path(references_csv).read_bytes()
    refs = corrected_references(raw_csv, data["metadata"], parent["samples"])
    predictions, blobs = [], {}
    for sample in parent["samples"]:
        stem = Path(sample["source_relative_path"]).stem
        candidates = [p for p in buzz_dir.iterdir() if p.is_file() and p.suffix == ".txt" and
                      (p.name == stem + ".txt" or p.name.startswith(stem + " (transcribed on "))]
        if len(candidates) != 1:
            raise ValueError(f"Need exactly one original Buzz text for {sample['sample_id']}")
        original = candidates[0]
        if original.is_symlink():
            raise ValueError("Original prediction cannot be a symlink")
        raw = original.read_bytes()
        raw.decode("utf-8-sig")  # Empty successful text remains a valid all-deletions prediction.
        adjacent = buzz_dir / (stem + ".mp3")
        if adjacent.exists() and (adjacent.is_symlink() or file_hash(adjacent) != sample["audio_sha256"]):
            raise ValueError("Audio adjacent to Buzz output differs from the frozen clip")
        saved_name = "inputs/predictions/" + stem + ".txt"
        blobs[saved_name] = raw
        predictions.append({"sample_id": sample["sample_id"], "audio_sha256": sample["audio_sha256"],
                            "export_filename": original.name, "snapshot": saved_name,
                            "sha256": file_hash(original), "adjacent_audio_verified": adjacent.exists()})
    profile = {"application": "Buzz", "engine": "Whisper", "model_id": None, "settings": None,
               "uniform_settings_attested": bool(uniform_settings),
               "attested_by": attested_by if uniform_settings else None}
    identity = {"parent_manifest_sha256": parent_hash, "reference_csv_sha256": file_hash(references_csv),
                "profile": profile, "predictions": predictions, "reviewer": reviewer,
                "attested_by": attested_by, "origin": origin}
    # Hash the actual bytes read, rather than a later read of a changing input file.
    identity["reference_csv_sha256"] = hashlib.sha256(raw_csv).hexdigest()
    for prediction in predictions:
        prediction["sha256"] = hashlib.sha256(blobs[prediction["snapshot"]]).hexdigest()
    folder = managed(output / "imported" / origin / digest(identity), output)
    with exclusive(folder):
        if (folder / "run.json").exists():
            return score_imported(folder, output, locked=True)
        snapshot(folder / "inputs/references.csv", raw_csv, output)
        for name, raw in blobs.items():
            snapshot(folder / name, raw, output)
        stamp = utc_now()
        records = []
        for s in parent["samples"]:
            records.append({**{k: s[k] for k in ("sample_id", "source_relative_path", "first_language", "spoken_language")},
                            "reviewer": reviewer, "reviewed_at": stamp, "status": "accepted",
                            "reason": f"{attested_by} confirms CSV transcript is friend's corrected reference; timestamp is receipt time.",
                            "meaning_review": "verified", "reference_override": refs[Path(s["source_relative_path"]).name],
                            "override_reason": "Human-corrected reference supplied by coordinator; CSV WER/SER ignored."})
        review_csv = managed(folder / "inputs/review.csv", output)
        if review_csv.exists():
            # Resume an interrupted import with its original attestation receipt time.
            with review_csv.open(encoding="utf-8", newline="") as stream:
                existing = list(csv.DictReader(stream))
            if len(existing) != 40:
                raise ValueError("Incomplete stored review input")
            stamp = existing[0]["reviewed_at"]
            for r in records:
                r["reviewed_at"] = stamp
            if existing != records:
                raise ValueError("Stored review input changed")
        else:
            write_csv(review_csv, records, REVIEW_FIELDS)
        pointer = import_review(parent_path, dataset_root, output, review_csv=review_csv)
        run = {"schema_version": SCHEMA_VERSION, "artifact_type": "imported_run",
               "run_id": "buzz-" + digest(identity)[:24], "identity": identity,
               "manifest_path": str(Path(pointer["manifest_path"]).relative_to(output)),
               "manifest_sha256": pointer["manifest_sha256"], "review_sha256": pointer["review_sha256"],
               "settings_sha256": digest(profile), "normalization_version": "en_v1", "created_at": stamp,
               "origin": origin, "provider": "buzz", "model_id": None, "settings": None,
               "request_count": 0, "submitted_audio_seconds": 0, "status": "complete", "code": code_state()}
        write_json(folder / "run.json", run, "ImportedRun")
        return score_imported(folder, output, locked=True)


def score_imported(run_dir, output, *, locked=False):
    """Recompute from hashed preserved inputs, independently of the CSV's old WER/SER."""
    output = Path(output).resolve()
    folder = managed(run_dir, output)
    run = read_json(managed(folder / "run.json", output))
    check(run, "ImportedRun")
    ident = run["identity"]
    if (folder != output / "imported" / run["origin"] / digest(ident) or
            run["run_id"] != "buzz-" + digest(ident)[:24] or run["origin"] != ident["origin"] or
            run["settings_sha256"] != digest(ident["profile"])):
        raise ValueError("Imported run identity mismatch")
    manifest, sha, receipt, rsha = reviewed_manifest(managed(output / run["manifest_path"], output), output)
    if sha != run["manifest_sha256"] or rsha != run["review_sha256"]:
        raise ValueError("Imported reference manifest changed")
    protect_source(output, receipt["dataset_root"])
    if not locked:
        with exclusive(folder):
            return score_imported(folder, output, locked=True)
    data = verified_dataset(receipt["dataset_root"], manifest)
    raw_csv = contained_file(folder, "inputs/references.csv")
    if (file_hash(raw_csv) != ident["reference_csv_sha256"] or
            receipt["basis"].get("csv_sha256") != file_hash(contained_file(folder, "inputs/review.csv")) or
            receipt["parent_manifest_sha256"] != ident["parent_manifest_sha256"]):
        raise ValueError("Imported reference snapshot/receipt changed")
    refs = corrected_references(raw_csv.read_bytes(), data["metadata"], manifest["samples"])
    predictions = {p["sample_id"]: p for p in ident["predictions"]}
    ids = {s["sample_id"] for s in manifest["samples"]}
    if len(ident["predictions"]) != 40 or set(predictions) != ids:
        raise ValueError("Imported run needs exactly the frozen 40 predictions")
    results, transcript_rows = [], []
    for sample in manifest["samples"]:
        p = predictions[sample["sample_id"]]
        expected = "inputs/predictions/" + Path(sample["source_relative_path"]).stem + ".txt"
        path = contained_file(folder, p["snapshot"])
        if p["snapshot"] != expected or file_hash(path) != p["sha256"] or p["audio_sha256"] != sample["audio_sha256"]:
            raise ValueError("Original Buzz prediction changed or is bound to a different audio clip")
        if sample["reference_raw"] != refs[Path(sample["source_relative_path"]).name]:
            raise ValueError("Reviewed reference differs from the supplied corrected CSV")
        text = path.read_bytes().decode("utf-8-sig")
        result = {"schema_version": SCHEMA_VERSION, "sample_id": sample["sample_id"], "run_id": run["run_id"],
                  "status": "succeeded", "prediction_raw": text, "provider_request_id": None,
                  "completed_at": None, "error_code": None, **score(sample["reference_raw"], text)}
        check(result, "TranscriptResult")
        results.append(result)
        transcript_rows.append({**sample, **result})
    cohorts = []
    for c in manifest["cohorts"]:
        selected = {s["sample_id"] for s in manifest["samples"] if s["cohort_id"] == c["cohort_id"]}
        cohorts.append({"cohort_id": c["cohort_id"], "first_language": c["first_language"], "spoken_language": "en",
                        **aggregate([r for r in results if r["sample_id"] in selected])})
    baseline = next(c["wer"] for c in cohorts if c["cohort_id"] == manifest["selection_config"]["baseline"]["cohort_id"])
    for c in cohorts:
        c["delta_wer_from_baseline"] = c["wer"] - baseline
    limitations = [
        "Descriptive pilot: 10 recordings per cohort, not representative of residents or municipal calls.",
        "Archive first language and census home language are different measures; ward weights are an exploratory proxy.",
        "All selected recordings are spoken English; these results do not evaluate recognition of Urdu, Arabic or Mandarin speech.",
        "Speaker, dialect, age, gender and recording differences may affect recognition.",
        "References are the friend's corrected text, as confirmed by Murtada; no independent agent listening review is claimed.",
        "Original Buzz exports are preserved. Exact Whisper model/version, decoding settings and generation times are unknown.",
        "The CSV's supplied WER/SER are excluded; recognition scores are recalculated from original Buzz predictions and corrected references.",
        "en_v1 does not expand numbers: digit-versus-word formatting can contribute to errors.",
        "Ward index is not an estimate of the number of people who will be misunderstood.",
    ]
    if ident["profile"]["uniform_settings_attested"]:
        limitations.append("A single unchanged Buzz model/settings profile was attested by the coordinator, not recovered from model metadata.")
    else:
        limitations.append("Uniform model/settings are unconfirmed; all ward recognition indices remain unavailable.")
    if run["origin"] == "fixture":
        limitations.append("Development fixture; excluded from real findings and ward index promotion.")
    prov = {"artifact_id": run["run_id"], "source_hashes": {**manifest["source_hashes"],
            "corrected_reference_csv": ident["reference_csv_sha256"],
            "original_buzz_exports": digest(ident["predictions"])}, "manifest_sha256": sha,
            "settings_sha256": run["settings_sha256"], "normalization_version": "en_v1",
            "generated_at": run["created_at"], "origin": run["origin"],
            "limitations": limitations, "attribution": manifest["attribution"]}
    summary = {"schema_version": SCHEMA_VERSION, "artifact_type": "summary", "run_id": run["run_id"],
               "cohorts": cohorts, "provenance": prov}
    check(summary, "Summary")
    wards = recognition_context(manifest, sha, data, summary, run["run_id"],
                                uniform_settings=ident["profile"]["uniform_settings_attested"])
    check(wards, "EvaluatedWards")
    # Validate every payload first, then atomically replace each independently reproducible file.
    atomic_write(managed(folder / "results.jsonl", output), b"".join(canonical_bytes(r) for r in results))
    write_json(managed(folder / "summary.json", output), summary, "Summary")
    write_csv(managed(folder / "transcripts.csv", output), transcript_rows, TRANSCRIPT_FIELDS)
    write_json(managed(folder / "wards.json", output), wards, "EvaluatedWards")
    write_json(managed(folder / "manifest.json", output), manifest, "Manifest")
    write_csv(managed(folder / "wards.csv", output), wards["wards"],
              ["ward", "population_language_base", "ward10_corrected", "knows_neither_english_nor_french",
               "covered_home_speakers", "top14_home_speakers", "coverage_of_top14", "index", "index_status", "run_id"])
    return {"run_directory": str(folder), "run_id": run["run_id"], "selected_clips": len(results),
            "reference_rows": len(refs), "network_requests": 0, "origin": run["origin"],
            "ward_index_ready": all(w["index_status"] == "ready" for w in wards["wards"]),
            "summary": summary, "wards": wards}
