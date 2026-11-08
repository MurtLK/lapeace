"""Versioned listening-review import; model drafts never become references implicitly."""

import copy
import csv
from datetime import datetime, timezone
from pathlib import Path

from .artifacts import atomic_write, check, digest, file_hash, read_json, write_csv, write_json
from .dataset import contained_file
from .metrics import normalize
from .pilot import REVIEW_FIELDS, read_frozen_manifest, validate_pending_bundle


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def managed(path, root):
    root = Path(root).resolve()
    path = Path(path)
    if any(p.is_symlink() for p in (path, *path.parents)
           if p.resolve() == root or p.parent.resolve().is_relative_to(root)):
        raise ValueError("Symlinks are not allowed in managed artifact paths")
    if not path.resolve().is_relative_to(root) or path.resolve() == root:
        raise ValueError("Artifact must be inside the selected artifact root")
    return path.resolve()


def protect_source(output, source):
    output, source = Path(output).resolve(), Path(source).resolve()
    if output == source or output.is_relative_to(source):
        raise ValueError("Artifacts must be outside the read-only dataset root")


def import_review(manifest_path, dataset_root, output, *, reviewer=None, attested_by=None,
                  note=None, review_csv=None):
    """Accept a completed CSV or an explicit coordinator attestation with no corrections."""
    output, dataset_root = Path(output).resolve(), Path(dataset_root).resolve()
    protect_source(output, dataset_root)
    manifest_path = managed(manifest_path, output)
    parent, parent_hash = read_frozen_manifest(manifest_path)
    validate_pending_bundle(manifest_path.parent, parent, parent_hash, "pending-" + parent_hash[:16])
    if review_csv:
        with Path(review_csv).open(encoding="utf-8-sig", newline="") as stream:
            reader = csv.DictReader(stream)
            if reader.fieldnames != REVIEW_FIELDS:
                raise ValueError("Review CSV headers do not match the frozen review contract")
            records = list(reader)
        basis = {"kind": "review_csv", "csv_sha256": file_hash(review_csv)}
    else:
        if not all(isinstance(x, str) and x.strip() for x in (reviewer, attested_by, note)):
            raise ValueError("Attestation requires reviewer, attested-by, and an explicit review note")
        stamp = utc_now()  # Receipt time, not an invented time of the actual listening work.
        records = [{**{k: s[k] for k in ("sample_id", "source_relative_path", "first_language", "spoken_language")},
                    "reviewer": reviewer, "reviewed_at": stamp, "status": "accepted", "reason": note,
                    "meaning_review": "verified", "reference_override": "", "override_reason": ""}
                   for s in parent["samples"]]
        basis = {"kind": "coordinator_attestation", "attested_by": attested_by, "note": note,
                 "timestamp_meaning": "attestation_recorded_at; actual listening time not supplied"}
    expected = {s["sample_id"]: s for s in parent["samples"]}
    if (len(records) != len(expected) or {r.get("sample_id") for r in records} != set(expected)
            or any(None in r or any(v is None for v in r.values()) for r in records)):
        raise ValueError("Review must contain exactly one complete row per selected sample")
    indexed = {r["sample_id"]: r for r in records}
    reviewed = copy.deepcopy(parent)
    for sample in reviewed["samples"]:
        r = indexed[sample["sample_id"]]
        if any(r[k] != sample[k] for k in ("source_relative_path", "first_language", "spoken_language")):
            raise ValueError("Review cannot change frozen sample metadata")
        if r["status"] != "accepted" or r["meaning_review"] != "verified" or not r["reviewer"].strip():
            raise ValueError("All 40 clips need accepted, verified, attributed reviews; exclusions need a new selection")
        if datetime.fromisoformat(r["reviewed_at"]).utcoffset() is None:
            raise ValueError("Review timestamp needs a timezone")
        if r["reference_override"]:
            if not r["override_reason"].strip() or not normalize(r["reference_override"]):
                raise ValueError("Reference override requires nonempty text and a reason")
            sample["reference_raw"] = r["reference_override"]
            sample["reference_source"] = "review-receipt.json:" + sample["sample_id"]
        sample["review_status"] = "accepted"
        if file_hash(contained_file(dataset_root, sample["source_relative_path"])) != sample["audio_sha256"]:
            raise ValueError("Audio differs from the frozen selection")
    reviewed["limitations"] = [x for x in parent["limitations"] if "needs listening review" not in x]
    reviewed["limitations"].append("Listening approval imported from recorded human review or coordinator attestation.")
    manifest_hash = digest(reviewed)
    # Include receipt identity in the directory: separate attestations cannot overwrite each other.
    receipt = {"schema_version": "1.0.0", "parent_manifest_sha256": parent_hash,
               "manifest_sha256": manifest_hash, "dataset_root": str(dataset_root),
               "basis": basis, "reviews": records,
               "source_references": {s["sample_id"]: s["reference_raw"] for s in parent["samples"]}}
    receipt_hash = digest(receipt)
    check(receipt, "ReviewReceipt")
    folder = managed(output / "reviewed" / manifest_hash / receipt_hash, output)
    folder.mkdir(parents=True, exist_ok=True)
    for name, value in (("manifest.json", reviewed), ("review-receipt.json", receipt)):
        target = folder / name
        if target.exists() and read_json(target) != value:
            raise ValueError("Existing reviewed artifact differs; refusing overwrite")
        write_json(target, value, "Manifest" if name == "manifest.json" else "ReviewReceipt")
    atomic_write(folder / "manifest.sha256", (manifest_hash + "\n").encode())
    write_csv(folder / "review_queue.csv", records, REVIEW_FIELDS)
    pointer = {"schema_version": "1.0.0", "manifest_path": str(folder / "manifest.json"),
               "manifest_sha256": manifest_hash, "review_sha256": receipt_hash,
               "dataset_root": str(dataset_root), "parent_manifest_sha256": parent_hash}
    write_json(output / "reviewed-pilot.json", pointer)
    return pointer


def reviewed_manifest(path, output):
    path = managed(path, output)
    manifest, sha = read_frozen_manifest(path)
    receipt = read_json(path.parent / "review-receipt.json")
    check(receipt, "ReviewReceipt")
    receipt_hash = digest(receipt)
    if (receipt["manifest_sha256"] != sha or path.parent.name != receipt_hash
            or any(s["review_status"] != "accepted" for s in manifest["samples"])):
        raise ValueError("Reviewed manifest/receipt identity mismatch")
    records = receipt["reviews"]
    ids = {s["sample_id"] for s in manifest["samples"]}
    if (len(records) != len(ids) or {r["sample_id"] for r in records} != ids
            or any(r["status"] != "accepted" or r["meaning_review"] != "verified" for r in records)):
        raise ValueError("Incomplete listening review receipt")
    protect_source(output, receipt["dataset_root"])
    return manifest, sha, receipt, receipt_hash
