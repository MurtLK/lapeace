# T10-offline-tests handoff

Task ID: T10-offline-tests  
Human owner: Murtada  
Agent and actual runtime: `/root/t10_offline_tests`, Codex native child  
Claim ID: 5fe8bbe6-c537-4d1b-959e-4031553f9b71  
Checkout and branch: `/Users/murtadalakhdar/.t3/projects/lapeace`, `main`  
Base commit: `8a9977adc76f849c2ffcc46677c6c65a897cddb8`  
Result commit: none; local edits only  
Status requested: coordinator review and integration; all 40 tests pass after the parent's identity-validation fixes.

## Delivered behavior

Forty `unittest` regression cases cover unsafe archive paths, normalized ZIP duplicates, symlink and special-file entries, local path containment, BOM CSV parsing, malformed rows, dataset accounting, corrected Ward 10, missing wards, positive census denominators, source/detail disagreement, Canadian-born baseline metadata, missing/changed audio, deterministic selection with fresh cohort RNGs, unchanged source metadata, English spoken-language hints, pending review and budget reporting, null census-only indices, and transcript metric edge cases.

Pending-bundle tests use a temporary, explicitly synthetic 40-sample selection with mocked decoding. They exercise the real JSON schemas and artifact writer. They verify frozen manifest bytes, rejection of missing bundle components and invented pending results, selected-ID consistency, and preservation of manual review CSV edits.

## Changed paths

- `tests/data_checks/__init__.py`
- `tests/data_checks/test_offline.py`
- `tests/metrics/__init__.py`
- `tests/metrics/test_metrics.py`
- `coordination/handoffs/T10-offline-tests.md`

The parent explicitly authorized package initializer files for discovery. No implementation, schema, dependency, registry, or source dataset edits were made by this child.

## Verification

Executed `.venv/bin/python -m unittest discover -s tests -p 'test_*.py'`.

- The first 38 cases passed in 0.483 seconds.
- Two additional mixed-settings regression cases reproduced actual defects: a changed run `model_id` with its old settings hash was accepted, and a summary with a different provenance settings hash was accepted. The parent fixed both checks in `validate_pending_bundle`.
- Final verification after those fixes: **40 tests passed in 0.628 seconds** with the command above. The strict transcript CSV checks also accept the real `prepare_pilot` output in the toy fixtures and preserve edited human review CSV rows.
- Test fixtures use mock audio decoding and local temporary bytes. No real provider processing, live benchmark, full real-audio decode, application API/UI tests, or release acceptance is claimed by this task.

## Data and provider accounting

No source dataset was changed. All fixture inputs and outputs live in temporary directories and are deleted after each case. No paid provider calls, credentials, uploads, or network operations were used. Metric examples are synthetic math tests and do not establish project recognition performance.

## Contract proposals and unresolved issues

No remaining implementation defect was observed within this test scope. The parent fixed actual run-payload comparison and summary provenance settings validation; both corresponding regression tests pass. This is bounded offline verification, not an independent full release review.

## Next handoff

The coordinator reviews and integrates the tests, then records final status in `coordination/tasks.json`. Human listening/reference review of real clips remains separate and incomplete.
