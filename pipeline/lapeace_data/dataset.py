"""Read-only source discovery, safe ZIP extraction, and tabular validation."""

from collections import Counter
import csv
import math
from pathlib import Path, PurePosixPath
import shutil
import stat
import tempfile
import unicodedata
import zipfile

from .artifacts import file_hash, read_json, write_json

ARCHIVE = "Mississauga_Unheard_ElevenLabs_Track.zip"
ARCHIVE_ROOT = "Mississauga_Unheard_ElevenLabs_Track"
ACCENT = "03_accented_english_SpeechAccentArchive"
CENSUS = "01_people_census/derived"
REQUIRED = [f"{CENSUS}/language_coverage.csv", f"{CENSUS}/ward_language_profile_2021_corrected.csv",
            f"{CENSUS}/geo_language_long.csv", "language_crosswalk.csv", f"{ACCENT}/metadata.csv",
            f"{ACCENT}/elicitation_paragraph.txt", "README.md", "DATA_DICTIONARY.md", "LICENSES.md"]


def relative_name(name):
    if not name or "\\" in name or ":" in name or "\x00" in name:
        raise ValueError(f"Unsafe relative path: {name!r}")
    path = PurePosixPath(name)
    if path.is_absolute() or ".." in path.parts or not path.parts:
        raise ValueError(f"Unsafe relative path: {name!r}")
    return path.as_posix()


def contained_file(root, name):
    name = relative_name(name)
    root = Path(root).resolve()
    path = root / name
    # No source symlinks, even those resolving within the dataset.
    if any(p.is_symlink() for p in [path, *path.parents] if p != root and root in p.parents):
        raise ValueError(f"Symlink in dataset path: {name}")
    if not path.resolve().is_relative_to(root) or not path.is_file():
        raise ValueError(f"Missing or unsafe source file: {name}")
    return path


def validated_members(archive):
    seen, total, result = set(), 0, []
    for entry in archive.infolist():
        name = relative_name(entry.filename)
        key = unicodedata.normalize("NFC", name).casefold()
        mode = entry.external_attr >> 16
        if key in seen or stat.S_ISLNK(mode):
            raise ValueError(f"Duplicate or symlink ZIP entry: {name}")
        if stat.S_IFMT(mode) not in (0, stat.S_IFREG, stat.S_IFDIR):
            raise ValueError(f"Unsupported ZIP entry: {name}")
        seen.add(key)
        total += entry.file_size
        if entry.file_size > 256 * 1024**2 or total > 2 * 1024**3 or entry.flag_bits & 1:
            raise ValueError("ZIP exceeds offline extraction limits or is encrypted")
        result.append((entry, name))
    if len(result) > 10000:
        raise ValueError("Too many ZIP entries")
    return result


def discover(source, raw_dir):
    source = Path(source).expanduser().resolve()
    if source.is_dir() and (source / "01_people_census").is_dir():
        return source, {}
    if source.is_dir() and (source / ARCHIVE_ROOT / "01_people_census").is_dir():
        return source / ARCHIVE_ROOT, {}
    archive_path = source / ARCHIVE if source.is_dir() else source
    if not archive_path.is_file():
        raise ValueError("Dataset source must be the pack directory, dataset root, or ZIP file")
    archive_hash = file_hash(archive_path)
    raw_dir = Path(raw_dir).resolve()
    if raw_dir == source or raw_dir.is_relative_to(source if source.is_dir() else source.parent):
        raise ValueError("Extraction directory must be outside the read-only source")
    destination = raw_dir / archive_hash
    with zipfile.ZipFile(archive_path) as archive:
        members = validated_members(archive)  # Inspect every entry before writing any.
        if destination.exists():
            marker = contained_file(destination, "extraction.json")
            record = read_json(marker)
            if record["archive_sha256"] != archive_hash:
                raise ValueError("Extraction cache identity mismatch")
            for name, expected in record["files"].items():
                if file_hash(contained_file(destination / ARCHIVE_ROOT, name)) != expected:
                    raise ValueError(f"Extraction cache changed: {name}; choose a fresh --raw-dir")
            return destination / ARCHIVE_ROOT, {"archive_sha256": archive_hash}
        raw_dir.mkdir(parents=True, exist_ok=True)
        stage = Path(tempfile.mkdtemp(prefix=".extract-", dir=raw_dir))
        try:
            hashes = {}
            for entry, name in members:
                prefix = ARCHIVE_ROOT + "/"
                if entry.is_dir() or not name.startswith(prefix):
                    continue
                relative = name[len(prefix):]
                # Only extract this milestone's sources; no unrelated 311 or speech collections.
                if relative not in REQUIRED and not relative.startswith(ACCENT + "/audio/"):
                    continue
                target = stage / name
                target.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(entry) as inp, target.open("xb") as out:
                    shutil.copyfileobj(inp, out)
                hashes[relative] = file_hash(target)
            for name in REQUIRED:
                contained_file(stage / ARCHIVE_ROOT, name)
            write_json(stage / "extraction.json", {"archive_sha256": archive_hash, "files": hashes})
            stage.rename(destination)
        finally:
            if stage.exists():
                shutil.rmtree(stage)
    return destination / ARCHIVE_ROOT, {"archive_sha256": archive_hash}


def rows(root, name, required):
    with contained_file(root, name).open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        if not reader.fieldnames or len(set(reader.fieldnames)) != len(reader.fieldnames):
            raise ValueError(f"Missing or duplicate CSV headers: {name}")
        if not set(required).issubset(reader.fieldnames):
            raise ValueError(f"Missing columns in {name}: {sorted(set(required) - set(reader.fieldnames))}")
        result = list(reader)
        if any(None in row or any(v is None for v in row.values()) for row in result):
            raise ValueError(f"Malformed CSV row: {name}")
        return result


def unique(records, field, label):
    values = [r[field] for r in records]
    if any(not v for v in values) or len(set(values)) != len(values):
        raise ValueError(f"Missing or duplicate {label}")


def count(value, label):
    try:
        result = int(value)
    except (ValueError, TypeError) as error:
        raise ValueError(f"Invalid integer {label}: {value!r}") from error
    if result < 0:
        raise ValueError(f"Negative {label}")
    return result


def validate_dataset(root, archive_hashes):
    source_hashes = {name: file_hash(contained_file(root, name)) for name in REQUIRED}
    source_hashes.update(archive_hashes)
    metadata = rows(root, f"{ACCENT}/metadata.csv", ["file", "language", "duration_sec", "birth_country"])
    crosswalk = rows(root, "language_crosswalk.csv", ["language", "census_home_column"])
    coverage = rows(root, f"{CENSUS}/language_coverage.csv",
                    ["language", "city_home_speakers", "accent_archive_speakers", "census_home_column"])
    wards = rows(root, f"{CENSUS}/ward_language_profile_2021_corrected.csv",
                 ["ward", "ward10_corrected", "population_language_base", "top14_nonofficial_home_language_speakers"])
    detail = rows(root, f"{CENSUS}/geo_language_long.csv",
                  ["geo_level", "geo", "language", "home_speakers", "population_language_base"])
    unique(metadata, "file", "audio paths")
    unique(crosswalk, "language", "crosswalk languages")
    unique(coverage, "language", "coverage languages")
    unique(wards, "ward", "wards")
    if {count(w["ward"], "ward") for w in wards} != set(range(1, 12)):
        raise ValueError("Expected exactly wards 1 through 11")
    languages = {r["language"] for r in crosswalk}
    counts = Counter(r["language"] for r in metadata)
    audio_hashes = {}
    ids = set()
    for row in metadata:
        name = relative_name(row["file"])
        if not name.startswith("audio/") or Path(name).suffix.lower() != ".mp3":
            raise ValueError(f"Unexpected archive audio path: {name}")
        sample_id = "saa:" + Path(name).stem
        if sample_id in ids or row["language"] not in languages:
            raise ValueError(f"Duplicate ID or unknown language: {sample_id}")
        ids.add(sample_id)
        duration = float(row["duration_sec"])
        if not math.isfinite(duration) or duration <= 0:
            raise ValueError(f"Invalid duration: {name}")
        audio_hashes[f"{ACCENT}/{name}"] = file_hash(contained_file(root, f"{ACCENT}/{name}"))
        if row["language"] == "English" and row["birth_country"].casefold() != "canada":
            raise ValueError("English baseline must contain Canadian-born speakers")
    for row in coverage:
        if count(row["accent_archive_speakers"], "archive count") != counts[row["language"]]:
            raise ValueError(f"Coverage/metadata count mismatch: {row['language']}")
        if row["census_home_column"]:
            count(row["city_home_speakers"], "city home-language count")
        elif row["city_home_speakers"]:
            count(row["city_home_speakers"], "city home-language count")
    home_columns = [r["census_home_column"] for r in crosswalk if r["census_home_column"]]
    details = {(r["geo"], r["language"]): r for r in detail if r["geo_level"] == "ward"}
    if len(details) != sum(r["geo_level"] == "ward" for r in detail):
        raise ValueError("Duplicate ward/language detail")
    for ward in wards:
        if count(ward["population_language_base"], "language population") <= 0:
            raise ValueError("Ward language denominator must be positive")
        if ward["ward10_corrected"].casefold() not in ("true", "false"):
            raise ValueError("Invalid ward correction flag")
        if ward["ward"] == "10" and ward["ward10_corrected"].casefold() != "true":
            raise ValueError("Ward 10 must be corrected")
        if sum(count(ward[c], c) for c in home_columns) != count(ward["top14_nonofficial_home_language_speakers"], "top14"):
            raise ValueError("Ward top14 total mismatch")
        for language in crosswalk:
            col = language["census_home_column"]
            if not col:
                continue
            joined = details.get((ward["ward"], language["language"]))
            if joined is None or count(joined["home_speakers"], col) != count(ward[col], col):
                raise ValueError(f"Corrected ward/detail mismatch: {ward['ward']} {col}")
            if count(joined["population_language_base"], "detail denominator") != int(ward["population_language_base"]):
                raise ValueError("Ward/detail denominator mismatch")
    return {"metadata": metadata, "crosswalk": crosswalk, "coverage": coverage, "wards": wards,
            "source_hashes": source_hashes, "audio_hashes": audio_hashes,
            "counts_by_first_language": dict(sorted(counts.items()))}
