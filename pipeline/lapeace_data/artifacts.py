"""Canonical, atomic artifact IO and versioned contract checks."""

import csv
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile

from jsonschema import Draft202012Validator

SCHEMA_VERSION = "1.0.0"
PROJECT_ROOT = Path(__file__).resolve().parents[2]


def canonical_bytes(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
                       allow_nan=False) + "\n").encode("utf-8")


def digest(value):
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def file_hash(path):
    with Path(path).open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def atomic_write(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix="." + path.name, dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as target:
            target.write(data)
            target.flush()
            os.fsync(target.fileno())
        os.replace(name, path)
    finally:
        Path(name).unlink(missing_ok=True)


def check(value, definition):
    schema = json.loads((PROJECT_ROOT / "contracts/v1/offline.schema.json").read_text())
    Draft202012Validator({"$ref": f"#/$defs/{definition}", "$defs": schema["$defs"]}).validate(value)


def write_json(path, value, definition=None):
    if definition:
        check(value, definition)
    atomic_write(path, canonical_bytes(value))


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_csv(path, records, fields):
    stream = io.StringIO(newline="")
    writer = csv.DictWriter(stream, fields, extrasaction="ignore", lineterminator="\n")
    writer.writeheader()
    writer.writerows(records)
    atomic_write(path, stream.getvalue().encode("utf-8"))


def code_state():
    def git(*args):
        return subprocess.check_output(["git", *args], cwd=PROJECT_ROOT, text=True).strip()
    source_paths = [PROJECT_ROOT / "pyproject.toml", PROJECT_ROOT / "contracts/v1/offline.schema.json"]
    source_paths += sorted((PROJECT_ROOT / "pipeline/lapeace_data").glob("*.py"))
    hashes = {p.relative_to(PROJECT_ROOT).as_posix(): file_hash(p) for p in source_paths}
    try:
        sha, dirty = git("rev-parse", "HEAD"), bool(git("status", "--porcelain"))
    except (OSError, subprocess.CalledProcessError):
        sha, dirty = None, None
    return {"git_sha": sha, "git_dirty": dirty, "source_hashes": hashes,
            "source_tree_sha256": digest(hashes)}
