"""Operator CLI. All implemented stages are offline, including dry-run transcription."""

import argparse
import json
import os
from pathlib import Path
import sys
import zipfile

from jsonschema.exceptions import ValidationError

from .artifacts import PROJECT_ROOT, SCHEMA_VERSION, read_json, write_json
from .dataset import discover, validate_dataset
from .pilot import (dry_run, load_config, prepare_pilot, read_frozen_manifest,
                    read_preparation, validate_pending_bundle)
from .wards import census_context


def parser():
    result = argparse.ArgumentParser(description="LAPEACE offline pipeline; no credentials or provider calls")
    stages = result.add_subparsers(dest="stage", required=True)
    for name in ["validate", "select", "prepare", "export-wards"]:
        command = stages.add_parser(name)
        command.add_argument("--source", default=os.environ.get("LAPEACE_DATASET_SOURCE"))
        command.add_argument("--raw-dir", type=Path, default=PROJECT_ROOT / "data/raw")
        command.add_argument("--output-dir", type=Path, default=PROJECT_ROOT / "data/derived")
        command.add_argument("--config", type=Path, default=PROJECT_ROOT / "config/pilot.json")
        if name == "export-wards":
            command.add_argument("--manifest", type=Path, required=True)
    command = stages.add_parser("transcribe", help="Print an estimate without provider calls or file writes")
    command.add_argument("--manifest", type=Path, required=True)
    command.add_argument("--dry-run", action="store_true")
    return result


def main(argv=None):
    args = parser().parse_args(argv)
    try:
        if args.stage == "transcribe":
            manifest, manifest_hash = read_frozen_manifest(args.manifest)
            report = dry_run(manifest, manifest_hash)
            # Reporting a manifest never writes beside it, even when it lives in source data.
            print(json.dumps(report, indent=2))
            return 0
        if not args.source:
            raise ValueError("Set LAPEACE_DATASET_SOURCE or pass --source /absolute/path/to/pack")
        source = Path(args.source).expanduser().resolve()
        output = args.output_dir.resolve()
        source_dir = source if source.is_dir() else source.parent
        if output == source_dir or output.is_relative_to(source_dir):
            raise ValueError("Output directory must be outside the read-only source")
        if args.stage == "export-wards":
            manifest_path = args.manifest.resolve()
            if not manifest_path.is_relative_to(output) or manifest_path.is_relative_to(source_dir):
                raise ValueError("Manifest must be within --output-dir and outside the read-only source")
            pilot_dir = manifest_path.parent
            manifest, manifest_hash = read_frozen_manifest(manifest_path)
            validate_pending_bundle(pilot_dir, manifest, manifest_hash, "pending-" + manifest_hash[:16])
        root, archive_hashes = discover(source, args.raw_dir)
        data = validate_dataset(root, archive_hashes)
        validation = {"schema_version": SCHEMA_VERSION, "artifact_type": "validation",
                      "counts_by_first_language": data["counts_by_first_language"],
                      "audio_files_checked": len(data["audio_hashes"]), "wards_checked": len(data["wards"]),
                      "source_hashes": data["source_hashes"], "network_requests": 0}
        write_json(output / "validation.json", validation, "Validation")
        if args.stage == "validate":
            print(json.dumps(validation, indent=2))
            return 0
        if args.stage == "export-wards":
            if data["source_hashes"] != manifest["source_hashes"] or data["audio_hashes"] != manifest["candidate_audio_hashes"]:
                raise ValueError("Dataset differs from the frozen manifest")
        else:
            pilot_dir = prepare_pilot(root, data, load_config(args.config), output)
            manifest, manifest_hash = read_frozen_manifest(pilot_dir / "manifest.json")
        timestamp = read_preparation(pilot_dir)["generated_at"]
        expected_wards = census_context(manifest, manifest_hash, data, timestamp)
        if (pilot_dir / "wards.json").exists() and read_json(pilot_dir / "wards.json") != expected_wards:
            raise ValueError("Stored census context differs from the validated source")
        if args.stage in ("prepare", "export-wards"):
            write_json(pilot_dir / "wards.json", expected_wards, "Wards")
        report = dry_run(manifest, manifest_hash)
        write_json(pilot_dir / "dry-run.json", report, "DryRun")
        # An explicit local pointer for operator convenience, never an approved active-run.json.
        write_json(output / "offline-pilot.json", {"schema_version": SCHEMA_VERSION,
                   "manifest_sha256": manifest_hash, "manifest_path": str(pilot_dir / "manifest.json"),
                   "dataset_root": str(root), "execution_mode": "unavailable", "evidence_status": "unmeasured"})
        print(json.dumps({"status": "offline_prepared", "pilot_directory": str(pilot_dir),
                          "selected_clips": len(manifest["samples"]), "network_requests": 0,
                          "within_budget": report["within_budget"], "review_status": "pending"}, indent=2))
        return 0
    except (ValueError, OSError, KeyError, zipfile.BadZipFile, ValidationError) as error:
        print(f"Pipeline stopped: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
