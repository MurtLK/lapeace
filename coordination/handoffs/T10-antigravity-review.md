# Task handoff

Task ID: T10-antigravity-review  
Human owner: Murtada (coordinator/reviewer)  
Agent and actual runtime: `antigravity-reviewer`, Antigravity (`gemini-4-argon`)  
Claim ID: `db3a59c9-2d3e-471b-a545-08d4855956dd`  
Checkout and branch: `/Users/murtadalakhdar/.t3/projects/lapeace`, `main`  
Base commit: `8a9977adc76f849c2ffcc46677c6c65a897cddb8`  
Result commit if created: none (read-only review; only claim and handoff written)  
Status requested from coordinator: review

## Delivered behavior

Independently reviewed the uncommitted offline data preparation pipeline (`pipeline/lapeace_data/`), schema (`contracts/v1/offline.schema.json`), configuration (`config/pilot.json`), tests (`tests/data_checks/test_offline.py`, `tests/metrics/test_metrics.py`), and generated real artifacts pointed to by `data/derived/offline-pilot.json`.

Verified the coordinator's prior run claims directly from actual files and independent temporary-directory executions without mutating source files or real derived artifacts:
- **Source pack integrity:** `/Users/murtadalakhdar/Downloads/Datasets/ElevenLabs Track - Mississauga Unheard/Mississauga_Unheard_ElevenLabs_Track.zip` is unchanged with SHA-256 `db3bd4f8469a7302d5c6c2d013661a065c3cd6b90728fc8930a113828e4c4052`.
- **Dataset validation:** 468 referenced Speech Accent Archive `.mp3` files checked and hashed; 11 wards checked; Ward 10 `ward10_corrected=true`; all 14 home-language columns sum to `top14_nonofficial_home_language_speakers` and match `geo_language_long.csv`.
- **Deterministic selection & decoding:** Seed `20261107` with fresh per-cohort `random.Random(seed)` shuffles selects 40 clips (10 Canadian-born English baseline + 10 Urdu + 10 Arabic + 10 Mandarin Chinese) and ordered reserves (`english`: 35, `urdu`: 19, `arabic`: 30, `mandarin`: 30). Independent `prepare` execution into a fresh `TemporaryDirectory` reproduced the exact manifest bytes and SHA-256 (`22373a9a40beaebc2eddcb3c4a8814b7ab3e8c194ff2388643e811546e1fb6f0`).
- **Spoken vs. first language:** All 40 selected samples record `spoken_language="en"` and preserve cohort `first_language` separately from census home language.
- **Budget & pending state:** Estimated duration is `1162.857331` seconds across 40 requests (within caps of 45 attempts / 1,800 seconds), `0` network/provider requests made, all 40 samples `pending` review, all transcript results and ward recognition indices `null` / `incomplete`, and no `active-run.json` created.
- **Prior test agent fixes verified:** Confirmed `validate_pending_bundle` in `pipeline/lapeace_data/pilot.py` (lines 194–200 and 212–216) checks both `run.json` payload fields (`provider`, `model_id`, `settings`, `normalization_version`) against `manifest["selection_config"]` and `summary.json` provenance `settings_sha256` against `expected_settings`. All 40 regression tests in `tests/` pass.

Identified **3 confirmed findings** (2 Medium, 1 Low) in CLI path containment and rerun/stage validation.

## Changed paths

- `coordination/claims/T10-antigravity-review.json` (exclusive local claim, gitignored)
- `coordination/handoffs/T10-antigravity-review.md` (this review handoff)

No source files, configurations, schemas, tests, review CSVs, or generated artifacts in `data/` were modified.

## Verification

Commands executed:
1. `.venv/bin/python -m unittest discover -s tests -p 'test_*.py' -v` -> **40 tests passed in 0.626s** (mocked media decoding on temporary synthetic fixtures).
2. Read-only inspection and `Draft202012Validator` validation of all generated artifacts under `data/derived/` (`validation.json`, `offline-pilot.json`, and `pilots/22373a9a40beaebc.../manifest.json`, `preparation.json`, `dry-run.json`, `wards.json`, `runs/pending-22373a9a40beaebc/{run.json,results.jsonl,summary.json,transcripts.csv}`, `review_queue.csv`) -> **passed**.
3. Independent full execution of `prepare`, rerun `prepare`, `select`, `export-wards`, and `transcribe --dry-run` against the real dataset into a temporary directory (`tempfile.TemporaryDirectory`) -> **passed**, reproducing manifest SHA-256 `22373a9a40beaebc2eddcb3c4a8814b7ab3e8c194ff2388643e811546e1fb6f0` byte-for-byte and keeping the source ZIP unchanged.
4. Standalone reproduction scripts in `TemporaryDirectory` confirming Findings 1–3 below -> **reproduced**.

## Data and provider accounting

- Source ZIP SHA-256: `db3bd4f8469a7302d5c6c2d013661a065c3cd6b90728fc8930a113828e4c4052` (unchanged)
- Frozen Manifest SHA-256: `22373a9a40beaebc2eddcb3c4a8814b7ab3e8c194ff2388643e811546e1fb6f0` (unchanged)
- Implementation `source_tree_sha256`: `3751fc3437ffaae3b45f29a5a97185b111fdeba8da46861518dd01c9785f0247`
- Paid provider requests: `0`
- Submitted audio seconds: `0`

## Contract proposals and unresolved issues

### Confirmed Findings

#### 1. [Medium] `--manifest` path in `transcribe` and `export-wards` is not checked against the read-only source directory and writes artifacts into `args.manifest.parent`
- **Location:** `pipeline/lapeace_data/__main__.py:38-43`, `pipeline/lapeace_data/__main__.py:49-50`, `pipeline/lapeace_data/__main__.py:61-73`
- **Trigger:** Running `export-wards` or `transcribe --dry-run` with `--manifest` pointing to a manifest file located inside the source directory (or an arbitrary directory outside `--output-dir`).
- **Impact:**
  1. In `transcribe` (lines 38–43), `args.manifest` is never checked against `source` or `--output-dir`, and `write_json(args.manifest.parent / "dry-run.json", ...)` writes directly to `args.manifest.parent`. Moreover, `--dry-run` is an optional flag (`action="store_true"` at line 31) that is never checked, so `python -m lapeace_data transcribe --manifest ...` (without `--dry-run`) silently executes the dry-run and overwrites `dry-run.json`.
  2. In `export-wards` (lines 61–73), `output` (`--output-dir`) is checked against `source_dir` at lines 49–50, but `pilot_dir` is set to `args.manifest.parent` (line 65) without checking whether `pilot_dir` is inside `source_dir`. `export-wards` then writes `wards.json` and `dry-run.json` into `args.manifest.parent`, violating read-only source protection if `--manifest` resides under `source_dir`.
- **Minimal reproduction:**
  ```sh
  .venv/bin/python -c '
  import shutil, tempfile
  from pathlib import Path
  from lapeace_data.__main__ import main
  from lapeace_data.artifacts import read_json

  root = Path("/Users/murtadalakhdar/.t3/projects/lapeace")
  ptr = read_json(root / "data/derived/offline-pilot.json")
  with tempfile.TemporaryDirectory() as tmp:
      t = Path(tmp)
      fake_source = t / "fake_source"
      shutil.copytree(Path(ptr["dataset_root"]), fake_source / "Mississauga_Unheard_ElevenLabs_Track")
      main(["select", "--source", str(fake_source), "--raw-dir", str(t / "raw"), "--output-dir", str(t / "derived")])
      sel_ptr = read_json(t / "derived/offline-pilot.json")
      bad_pilot = fake_source / "pilot"
      shutil.copytree(Path(sel_ptr["manifest_path"]).parent, bad_pilot)
      rc = main(["export-wards", "--source", str(fake_source), "--raw-dir", str(t / "raw"),
                 "--output-dir", str(t / "safe_out"), "--manifest", str(bad_pilot / "manifest.json")])
      assert rc == 0 and (bad_pilot / "wards.json").exists(), "Wrote wards.json inside read-only source!"
      print("Reproduced: export-wards wrote wards.json inside fake_source")
  '
  ```

#### 2. [Medium] `validate_pending_bundle` does not validate `review_queue.csv` headers, immutable sample fields, or allowed enum values on rerun
- **Location:** `pipeline/lapeace_data/pilot.py:224-238`
- **Trigger:** Editing `review_queue.csv` before a rerun of `prepare` or `select` in a way that drops required columns (e.g., `status`, `meaning_review`, `reference_override`), alters immutable sample metadata (`source_relative_path`, `first_language`, `spoken_language`), or writes invalid enum values (`status` not in `pending|accepted|excluded`, `meaning_review` not in `verified|unverified`), while keeping the 40 `sample_id` values intact.
- **Impact:** Unlike `transcripts.csv` (which strictly checks `reader.fieldnames != TRANSCRIPT_FIELDS` and every cell at lines 227–238), `review_queue.csv` only checks `len(records) != len(selected) or {r["sample_id"] for r in records} != set(selected)` (line 230). A corrupted `review_queue.csv` with missing review columns or invalid statuses silently passes rerun validation and reports `"status": "offline_prepared"`.
- **Minimal reproduction:**
  ```sh
  .venv/bin/python -c '
  import shutil, tempfile
  from pathlib import Path
  from lapeace_data.artifacts import read_json
  from lapeace_data.pilot import validate_pending_bundle

  root = Path("/Users/murtadalakhdar/.t3/projects/lapeace")
  ptr = read_json(root / "data/derived/offline-pilot.json")
  real_pilot = Path(ptr["manifest_path"]).parent
  with tempfile.TemporaryDirectory() as tmp:
      pilot_copy = Path(tmp) / real_pilot.name
      shutil.copytree(real_pilot, pilot_copy)
      manifest = read_json(pilot_copy / "manifest.json")
      mhash = ptr["manifest_sha256"]
      (pilot_copy / "review_queue.csv").write_text(
          "sample_id,wrong_header\n" + "\n".join(f"{s[\"sample_id\"]},bad" for s in manifest["samples"]) + "\n"
      )
      validate_pending_bundle(pilot_copy, manifest, mhash, "pending-" + mhash[:16])
      print("Reproduced: validate_pending_bundle accepted corrupted review_queue.csv")
  '
  ```

#### 3. [Low] `export-wards` does not validate the pending bundle or existing `wards.json` on `select` reruns
- **Location:** `pipeline/lapeace_data/__main__.py:61-80`, `pipeline/lapeace_data/pilot.py:151-154`
- **Trigger:**
  1. Running `export-wards` against a pilot directory whose pending run bundle (`runs/pending-.../summary.json`, `results.jsonl`, or `run.json`) has been deleted or tampered with, or whose `preparation.json` is missing (`select` alone only creates `preparation.json` via `prepare_pilot`, but if `preparation.json` is missing or tampered, `read_json(pilot_dir / "preparation.json")` fails without schema check).
  2. Running `select` on an existing `prepare` directory where `wards.json` was tampered with (e.g., given a fabricated `index`): `prepare_pilot` returns early at line 154 after `validate_pending_bundle`, which does not check `wards.json` or `dry-run.json`.
- **Impact:** `export-wards` can succeed and update `offline-pilot.json` to point to a pilot directory with a broken or tampered pending run bundle, and `select` reruns do not detect tampering in an already-written `wards.json`.
- **Minimal reproduction:**
  ```sh
  .venv/bin/python -c '
  import shutil, tempfile
  from pathlib import Path
  from lapeace_data.__main__ import main
  from lapeace_data.artifacts import read_json

  root = Path("/Users/murtadalakhdar/.t3/projects/lapeace")
  ptr = read_json(root / "data/derived/offline-pilot.json")
  real_pilot = Path(ptr["manifest_path"]).parent
  with tempfile.TemporaryDirectory() as tmp:
      t = Path(tmp)
      pilot_copy = t / "pilots" / real_pilot.name
      shutil.copytree(real_pilot, pilot_copy)
      (pilot_copy / "runs" / ("pending-" + ptr["manifest_sha256"][:16]) / "summary.json").unlink()
      rc = main(["export-wards", "--source", "/Users/murtadalakhdar/Downloads/Datasets/ElevenLabs Track - Mississauga Unheard",
                 "--raw-dir", str(root / "data/raw"), "--output-dir", str(t / "out"),
                 "--manifest", str(pilot_copy / "manifest.json")])
      assert rc == 0, "Expected export-wards to fail on missing summary.json"
      print("Reproduced: export-wards succeeded despite missing summary.json in pending bundle")
  '
  ```

### Untested Concerns & Residual Uncertainties

- **Cross-source-type `source_hashes` difference (`validate_dataset` / `export-wards`):** When `--source` is the ZIP file (or pack directory containing the ZIP), `discover()` returns `{"archive_sha256": archive_hash}` which is merged into `manifest["source_hashes"]`. When `--source` is an already-extracted dataset root directory, `discover()` returns `{}`. Consequently, running `export-wards` with `--source <extracted_root>` against a manifest created from `--source <zip_pack>` fails at `pipeline/lapeace_data/__main__.py:63` (`"Dataset differs from the frozen manifest"`). This is safe (fail-closed), though operators switching `--source` between the pack dir and an extracted dir will see a hash mismatch.
- **Extraction cache tamper scope (`pipeline/lapeace_data/dataset.py:81-89`):** On cached extraction hits, `discover()` verifies `archive_sha256` and every file hash listed in `extraction.json`, and `validate_dataset()` hashes all 468 metadata-referenced audio files and 9 required files. If `extraction.json` itself is malformed JSON/schema (e.g., `[]` causing `TypeError`), `main()` does not catch `TypeError` in `except (ValueError, OSError, KeyError, zipfile.BadZipFile, ValidationError)` and exits with a traceback (exit code 1).
- **Real audio listening verification:** `ffmpeg` and `ffprobe` verify container/stream decodability and duration within 1 second of `metadata.csv`, not human speech intelligibility or wording fidelity against `elicitation_paragraph.txt`. All 40 clips remain `review_status="pending"`.

### Planned Limitations (Not Defects)

- Live Scribe transcription (`transcribe --live`), review-queue import / manifest version bumping on reference override or media replacement, transcript scoring CLI (`score`), and `export-demo` / `active-run.json` generation are intentionally deferred outside this offline preparation milestone.
- Application (`server/lapeace_api/`) and UI (`web/`) scaffolds and contracts are owned by separate tasks/teammates under the current scope.

## Next handoff

Coordinator (`Murtada` / parent Codex agent) reviews the 3 findings above, applies any desired fixes to `pipeline/lapeace_data/__main__.py` and `pipeline/lapeace_data/pilot.py`, re-runs `.venv/bin/python -m unittest discover -s tests -p 'test_*.py'`, and releases `coordination/claims/T10-antigravity-review.json` when marking `T10-antigravity-review` done in `coordination/tasks.json`.
