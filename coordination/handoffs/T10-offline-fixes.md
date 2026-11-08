# Antigravity review fixes

Task: T10-offline-fixes  
Owner/coordinator: Murtada; implementation and verification: /root, Codex  
Claim: af83f7dd-9713-45de-94b6-94efe925576f  
Workspace/branch: /Users/murtadalakhdar/.t3/projects/lapeace, main  
Base commit: 8a9977adc76f849c2ffcc46677c6c65a897cddb8; no result commit created  
Status: integrated and verified locally

## Confirmed findings resolved

1. **Output path protection.** `transcribe` now prints estimates only; it never writes beside the supplied manifest. Defaulting to a dry-run without the optional flag remains intentional. `export-wards` resolves the manifest path and requires it to be within the selected output root and outside source data before any artifact write. Symlink escapes are rejected. Pilot creation also rejects paths escaping the output root.
2. **Review-sheet integrity.** All review headers, complete rows, immutable source-path/language fields and status enums are validated. Valid reviewer annotations and review statuses remain editable and survive reruns; CSV edits still do not approve the frozen manifest.
3. **Complete bundle validation.** Ward exports now validate the pending run bundle before writing. Existing ward data is schema/provenance checked and compared with recomputed census context on stage reruns. Invalid existing estimates also stop the run. Missing preparation/run records are rejected without resetting review work.

## Changed files

- pipeline/lapeace_data/__main__.py
- pipeline/lapeace_data/pilot.py
- tests/data_checks/test_review_regressions.py (14 new regression cases)
- docs/pipeline/offline.md
- coordination/tasks.json and this handoff

The original independent review remains preserved at [T10-antigravity-review.md](T10-antigravity-review.md). The coordinator verified the fixes; Antigravity has not performed a second review of the patched version.

## Checks actually run

- `.venv/bin/python -m unittest discover -s tests -p 'test_*.py'`: **54 tests passed** (including 14 new cases for the review findings).
- Fresh temporary output directory with the real source pack: prepare, select rerun, export-wards and transcribe --dry-run all passed with Python sockets disabled.
- Reproduced exact manifest SHA-256: `22373a9a40beaebc2eddcb3c4a8814b7ab3e8c194ff2388643e811546e1fb6f0`.
- Source ZIP SHA-256 remains `db3bd4f8469a7302d5c6c2d013661a065c3cd6b90728fc8930a113828e4c4052`.
- Hashes of every pre-existing file under data/derived matched before and after verification. All stage writes during verification went to a temporary directory; estimate commands wrote no files.
- `.venv/bin/python -m compileall -q pipeline/lapeace_data`: passed.
- `uv lock --check --offline`: passed.
- Paid requests/submitted audio seconds: **0 / 0**.

## Remaining limitations

All 40 real clips remain pending listening review; no accuracy findings exist. Live transcription, review import/versioning, score/import and demo promotion remain deferred. Switching a frozen run between ZIP-backed and extracted-root source forms still fails closed because source provenance differs; continue using the same source form. Manually malformed extraction-cache metadata may produce a traceback; this was an untested concern in the review and is outside these three confirmed fixes.

Final implementation source-tree digest: e6802d645597e6821869d731dac59bca0ddb3dbf281cd2b6aaefa7637c045172.

## Next action

Murtada opens the existing review queue and starts listening/reference review. No new provider authorization or setup is required for that step.
