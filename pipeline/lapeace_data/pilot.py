"""Deterministic pilot selection and pending, explicitly unmeasured artifacts."""

from datetime import datetime, timezone, timedelta
import csv
import json
import math
from pathlib import Path
import platform
import random
import subprocess

from .artifacts import (SCHEMA_VERSION, atomic_write, canonical_bytes, check, code_state,
                        digest, file_hash, read_json, write_csv, write_json)
from .dataset import ACCENT, contained_file
from .metrics import aggregate, normalize

LIMITATIONS = [
    "Descriptive pilot: 10 recordings per cohort, not representative of residents or municipal calls.",
    "Archive first language and census language spoken most often at home are different measures.",
    "The supplied common paragraph needs listening review; references may differ from actual speech.",
    "Speaker, dialect, age, gender and recording differences may affect recognition.",
    "Offline preparation contains no provider predictions or measured recognition findings.",
]
ATTRIBUTION = [
    "Weinberger, S. (2015), Speech Accent Archive, George Mason University; https://accent.gmu.edu; CC BY-NC-SA 4.0.",
    "Contains information provided by the City of Mississauga, 2021 Census; https://data.mississauga.ca; City open data terms.",
    "Redistributed in the Sheridan Datathon 2026 Mississauga Unheard pack. See source LICENSES.md.",
]
TRANSCRIPT_FIELDS = ["sample_id", "cohort_id", "first_language", "spoken_language", "source_relative_path",
                     "audio_sha256", "duration_seconds", "reference_raw", "review_status", "license_id",
                     "run_id", "status", "prediction_raw", "wer", "cer"]
REVIEW_FIELDS = ["sample_id", "source_relative_path", "first_language", "spoken_language", "reviewer",
                 "reviewed_at", "status", "reason", "meaning_review", "reference_override", "override_reason"]


def load_config(path):
    config = read_json(path)
    check(config, "Config")
    cohorts = [config["baseline"], *config["comparisons"]]
    if len({c["cohort_id"] for c in cohorts}) != len(cohorts):
        raise ValueError("Duplicate cohort IDs")
    if len({c["first_language"] for c in cohorts}) != len(cohorts):
        raise ValueError("Duplicate first-language cohorts")
    if config["baseline"]["first_language"] != "English":
        raise ValueError("Baseline must be English")
    return config


def ordered_candidates(records, seed):
    ordered = sorted(records, key=lambda r: "saa:" + Path(r["file"]).stem)
    random.Random(seed).shuffle(ordered)
    return ordered


def inspect_media(path):
    try:
        probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                                "format=duration:stream=codec_type,channels,sample_rate",
                                "-of", "json", str(path)], capture_output=True, text=True,
                               check=True, timeout=30)
        info = json.loads(probe.stdout)
        duration = float(info["format"]["duration"])
        streams = [s for s in info["streams"] if s["codec_type"] == "audio"]
        if len(streams) != 1 or not math.isfinite(duration) or duration <= 0:
            raise ValueError("Expected one nonempty audio stream")
        subprocess.run(["ffmpeg", "-v", "error", "-xerror", "-nostdin", "-i", str(path),
                        "-map", "0:a:0", "-f", "null", "-"], capture_output=True,
                       check=True, timeout=30)
        return {"duration_seconds": duration, "channels": int(streams[0]["channels"]),
                "sample_rate_hz": int(streams[0]["sample_rate"]), "decode_status": "passed"}
    except (OSError, KeyError, subprocess.SubprocessError, ValueError) as error:
        raise ValueError(f"Media validation failed for {path.name}; review before using the next reserve") from error


def selection_manifest(root, data, config):
    reference = contained_file(root, f"{ACCENT}/elicitation_paragraph.txt").read_text(encoding="utf-8-sig")
    if not normalize(reference):
        raise ValueError("Empty normalized reference")
    coverage = {r["language"]: r for r in data["coverage"]}
    crosswalk = {r["language"]: r for r in data["crosswalk"]}
    candidates = sorted((r for r in data["coverage"] if r["census_home_column"] and
                         int(r["accent_archive_speakers"]) >= config["samples_per_cohort"]),
                        key=lambda r: (-int(r["city_home_speakers"]), r["language"]))
    if [r["language"] for r in candidates[:3]] != [c["first_language"] for c in config["comparisons"]]:
        raise ValueError("Configured comparisons do not match the three largest eligible home-language groups")
    selected, reserves = [], {}
    cohorts = [config["baseline"], *config["comparisons"]]
    for cohort in cohorts:
        language, cohort_id = cohort["first_language"], cohort["cohort_id"]
        ordered = ordered_candidates([r for r in data["metadata"] if r["language"] == language],
                                     config["selection_seed"])
        size = config["samples_per_cohort"]
        if len(ordered) < size:
            raise ValueError(f"Too few recordings for {language}")
        reserves[cohort_id] = ["saa:" + Path(r["file"]).stem for r in ordered[size:]]
        for row in ordered[:size]:
            name = f"{ACCENT}/{row['file']}"
            media = inspect_media(contained_file(root, name))
            metadata_duration = float(row["duration_sec"])
            if abs(media["duration_seconds"] - metadata_duration) > 1:
                raise ValueError(f"Duration mismatch for {name}; requires review")
            sample_id = "saa:" + Path(row["file"]).stem
            selected.append({"sample_id": sample_id, "dataset_id": "speech_accent_archive",
                             "source_relative_path": name, "audio_sha256": data["audio_hashes"][name],
                             **media, "spoken_language": "en", "first_language": language,
                             "cohort_id": cohort_id, "speaker_key": sample_id,
                             "reference_raw": reference, "reference_source": f"{ACCENT}/elicitation_paragraph.txt",
                             "review_status": "pending", "source_url": "https://accent.gmu.edu",
                             "license_id": "CC-BY-NC-SA-4.0", "source_metadata": dict(row)})
    versions = {}
    for name in ["ffmpeg", "ffprobe"]:
        versions[name] = subprocess.check_output([name, "-version"], text=True).splitlines()[0]
    rationale = [{"cohort_id": c["cohort_id"], "first_language": c["first_language"],
                  "census_home_column": crosswalk[c["first_language"]]["census_home_column"] or None,
                  "city_home_speakers": (int(coverage[c["first_language"]]["city_home_speakers"])
                                         if coverage[c["first_language"]]["city_home_speakers"] else None),
                  "available_recordings": data["counts_by_first_language"][c["first_language"]]}
                 for c in cohorts]
    return {"schema_version": SCHEMA_VERSION, "artifact_type": "manifest", "selection_config": config,
            "selection_rationale": "Canadian-born English baseline plus the top three eligible city home-language counts; these are different variables.",
            "cohorts": rationale, "python_version": platform.python_version(), "media_tools": versions,
            "source_hashes": data["source_hashes"], "candidate_audio_hashes": data["audio_hashes"],
            "samples": selected, "reserves": reserves, "exclusions": [],
            "limitations": LIMITATIONS, "attribution": ATTRIBUTION}


def provenance(manifest, manifest_hash, artifact_id, generated_at):
    config = manifest["selection_config"]
    settings_hash = digest({key: config[key] for key in ("provider", "model_id", "settings")})
    return {"artifact_id": artifact_id, "source_hashes": manifest["source_hashes"],
            "manifest_sha256": manifest_hash, "settings_sha256": settings_hash,
            "normalization_version": config["normalization_version"], "generated_at": generated_at,
            "origin": "provider", "limitations": LIMITATIONS, "attribution": ATTRIBUTION}


def prepare_pilot(root, data, config, output):
    manifest = selection_manifest(root, data, config)
    check(manifest, "Manifest")
    manifest_hash = digest(manifest)
    # Each selection has an immutable directory; reruns never overwrite a previous selection.
    output_root = Path(output).resolve()
    output = (output_root / "pilots" / manifest_hash).resolve()
    if not output.is_relative_to(output_root):
        raise ValueError("Pilot directory must remain within the output directory")
    manifest_path = output / "manifest.json"
    if manifest_path.exists() and file_hash(manifest_path) != manifest_hash:
        raise ValueError("Stored frozen manifest was modified")
    write_json(manifest_path, manifest, "Manifest")
    atomic_write(output / "manifest.sha256", (manifest_hash + "\n").encode())
    run_id = "pending-" + manifest_hash[:16]
    run_dir = output / "runs" / run_id
    if (run_dir / "run.json").exists():
        validate_pending_bundle(output, manifest, manifest_hash, run_id)
        # Do not reset existing results or human review work.
        return output
    if run_dir.exists() or (output / "review_queue.csv").exists():
        raise ValueError("Incomplete pending bundle; use a fresh output directory without resetting review work")
    state = output / "preparation.json"
    if not state.exists():
        generated_at = datetime.now(timezone.utc).isoformat()
        write_json(state, {"schema_version": SCHEMA_VERSION, "generated_at": generated_at, **code_state()})
    generated_at = read_preparation(output)["generated_at"]
    prov = provenance(manifest, manifest_hash, run_id, generated_at)
    run = {"schema_version": SCHEMA_VERSION, "run_id": run_id, "manifest_sha256": manifest_hash,
           "settings_sha256": prov["settings_sha256"], "provider": config["provider"],
           "model_id": config["model_id"], "settings": config["settings"],
           "normalization_version": config["normalization_version"], "created_at": generated_at,
           "origin": "provider", "request_count": 0, "submitted_audio_seconds": 0,
           "status": "pending", "evidence_status": "unmeasured", "code": code_state()}
    results = [{"schema_version": SCHEMA_VERSION, "sample_id": s["sample_id"], "run_id": run_id,
                "status": "pending", **{key: None for key in ["prediction_raw", "provider_request_id",
                "completed_at", "error_code", "word_edits", "reference_words", "character_edits",
                "reference_characters", "wer", "cer"]}} for s in manifest["samples"]]
    for result in results:
        check(result, "TranscriptResult")
    atomic_write(run_dir / "results.jsonl", b"".join(canonical_bytes(r) for r in results))
    cohorts = []
    for c in manifest["cohorts"]:
        ids = {s["sample_id"] for s in manifest["samples"] if s["cohort_id"] == c["cohort_id"]}
        cohorts.append({"cohort_id": c["cohort_id"], "first_language": c["first_language"],
                        "spoken_language": "en", **aggregate([r for r in results if r["sample_id"] in ids]),
                        "delta_wer_from_baseline": None})
    write_json(run_dir / "summary.json", {"schema_version": SCHEMA_VERSION, "artifact_type": "summary",
               "run_id": run_id, "cohorts": cohorts, "provenance": prov}, "Summary")
    indexed = {r["sample_id"]: r for r in results}
    write_csv(run_dir / "transcripts.csv", [{**s, **indexed[s["sample_id"]]} for s in manifest["samples"]], TRANSCRIPT_FIELDS)
    write_csv(output / "review_queue.csv", [{**s, "status": "pending", "meaning_review": "unverified"}
                                           for s in manifest["samples"]], REVIEW_FIELDS)
    # run.json is the completion marker for this pending bundle; write it last.
    write_json(run_dir / "run.json", run, "Run")
    return output


def read_preparation(output):
    state = read_json(Path(output) / "preparation.json")
    if not isinstance(state, dict) or state.get("schema_version") != SCHEMA_VERSION:
        raise ValueError("Invalid preparation record")
    stamp = datetime.fromisoformat(state["generated_at"])
    if stamp.utcoffset() != timedelta(0):
        raise ValueError("Preparation timestamp must be UTC")
    check({k: state[k] for k in ("git_sha", "git_dirty", "source_hashes", "source_tree_sha256")}, "Code")
    return state


def validate_pending_bundle(output, manifest, manifest_hash, run_id):
    """Fail visibly on incomplete/tampered reruns without resetting human work."""
    output = Path(output)
    state = read_preparation(output)
    run_dir = output / "runs" / run_id
    run = read_json(run_dir / "run.json")
    check(run, "Run")
    expected_settings = digest({k: manifest["selection_config"][k] for k in ("provider", "model_id", "settings")})
    if (run["status"] != "pending" or run["request_count"] != 0 or run["submitted_audio_seconds"] != 0
            or run["manifest_sha256"] != manifest_hash or run["settings_sha256"] != expected_settings
            or run["run_id"] != run_id or run["origin"] != "provider"
            or run["created_at"] != state["generated_at"]
            or any(run[k] != manifest["selection_config"][k]
                   for k in ("provider", "model_id", "settings", "normalization_version"))):
        raise ValueError("Offline preparation cannot overwrite a submitted or inconsistent run")
    selected = {s["sample_id"]: s for s in manifest["samples"]}
    results = [json.loads(line) for line in (run_dir / "results.jsonl").read_text().splitlines()]
    for record in results:
        check(record, "TranscriptResult")
        if record["status"] != "pending" or record["run_id"] != run_id:
            raise ValueError("Offline preparation cannot reset nonpending results")
    if len(results) != len(selected) or {r["sample_id"] for r in results} != set(selected):
        raise ValueError("Pending results do not match selected IDs")
    summary = read_json(run_dir / "summary.json")
    check(summary, "Summary")
    prov = summary["provenance"]
    if (summary["run_id"] != run_id or prov["manifest_sha256"] != manifest_hash
            or prov["settings_sha256"] != expected_settings or prov["source_hashes"] != manifest["source_hashes"]
            or prov["normalization_version"] != manifest["selection_config"]["normalization_version"]
            or prov["origin"] != "provider"):
        raise ValueError("Summary references do not match this pilot")
    expected_cohorts = []
    for cohort in manifest["cohorts"]:
        matching = [r for r in results if selected[r["sample_id"]]["cohort_id"] == cohort["cohort_id"]]
        expected_cohorts.append({"cohort_id": cohort["cohort_id"], "first_language": cohort["first_language"],
                                "spoken_language": "en", **aggregate(matching), "delta_wer_from_baseline": None})
    if summary["cohorts"] != expected_cohorts:
        raise ValueError("Pending cohort summary is inconsistent")
    for path in [run_dir / "transcripts.csv", output / "review_queue.csv"]:
        with path.open(encoding="utf-8", newline="") as stream:
            reader = csv.DictReader(stream)
            expected_fields = TRANSCRIPT_FIELDS if path.name == "transcripts.csv" else REVIEW_FIELDS
            if reader.fieldnames != expected_fields:
                raise ValueError(f"CSV headers are inconsistent: {path.name}")
            records = list(reader)
        if any(None in row or any(v is None for v in row.values()) for row in records):
            raise ValueError(f"Malformed CSV row: {path.name}")
        if len(records) != len(selected) or {r["sample_id"] for r in records} != set(selected):
            raise ValueError(f"Incomplete review or handoff file: {path.name}")
        if path.name == "transcripts.csv":
            indexed = {r["sample_id"]: r for r in results}
            for record in records:
                expected = {**selected[record["sample_id"]], **indexed[record["sample_id"]]}
                if any(record[key] != ("" if expected[key] is None else str(expected[key]))
                       for key in TRANSCRIPT_FIELDS):
                    raise ValueError("Pending CSV handoff is inconsistent")
        else:
            for record in records:
                sample = selected[record["sample_id"]]
                if any(record[k] != sample[k] for k in
                       ("source_relative_path", "first_language", "spoken_language")):
                    raise ValueError("Review sample metadata differs from the frozen manifest")
                if record["status"] not in ("pending", "accepted", "excluded"):
                    raise ValueError("Invalid review status")
                if record["meaning_review"] not in ("verified", "unverified"):
                    raise ValueError("Invalid meaning review status")
    if (output / "wards.json").exists():
        wards = read_json(output / "wards.json")
        check(wards, "Wards")
        expected = provenance(manifest, manifest_hash, "census-context", state["generated_at"])
        if wards["provenance"] != expected:
            raise ValueError("Ward provenance does not match this pilot")
    if (output / "dry-run.json").exists() and read_json(output / "dry-run.json") != dry_run(manifest, manifest_hash):
        raise ValueError("Stored dry-run report differs from the frozen manifest")


def read_frozen_manifest(path):
    path = Path(path)
    manifest = read_json(path)
    check(manifest, "Manifest")
    expected = path.with_suffix(".sha256").read_text().strip()
    if file_hash(path) != expected or digest(manifest) != expected:
        raise ValueError("Frozen manifest SHA-256 mismatch")
    ids = [s["sample_id"] for s in manifest["samples"]]
    if len(set(ids)) != len(ids):
        raise ValueError("Duplicate selected IDs")
    return manifest, expected


def dry_run(manifest, manifest_hash):
    config = manifest["selection_config"]
    duration = sum(s["duration_seconds"] for s in manifest["samples"])
    count = len(manifest["samples"])
    budget = config["budget"]
    return {"schema_version": SCHEMA_VERSION, "artifact_type": "dry_run",
            "manifest_sha256": manifest_hash, "mode": "offline", "network_requests": 0,
            "estimated_requests": count, "estimated_audio_seconds": round(duration, 6),
            "budget": budget, "within_budget": count <= budget["max_attempts"] and duration <= budget["max_submitted_audio_seconds"],
            "attempts_remaining_after_initial_pilot": max(0, budget["max_attempts"] - count),
            "audio_seconds_remaining_after_initial_pilot": round(max(0, budget["max_submitted_audio_seconds"] - duration), 6),
            "n_review_pending": sum(s["review_status"] != "accepted" for s in manifest["samples"]),
            "live_ready": False,
            "next_gate": "Listen to the selected clips and review references before implementing the bounded two-clip Scribe smoke test."}
