# T10-offline handoff

Task ID: T10-offline  
Human owner/coordinator: Murtada  
Agent/runtime: /root, Codex; two native agents handled tests and the operating guide  
Claim ID: a458690a-aec9-4fc2-9a58-9190171e08b3  
Checkout/branch: /Users/murtadalakhdar/.t3/projects/lapeace, main  
Base commit: 8a9977adc76f849c2ffcc46677c6c65a897cddb8  
Result commit: none (local changes only)  
Status: reviewed and integrated by coordinator; offline milestone complete

## Delivered behavior

A Python 3.12 pipeline with a locked environment now reads the source pack without modifying it, inspects every ZIP entry before extracting only the required census/archive inputs, checks metadata and audio hashes, verifies corrected census joins, and selects 40 recordings with seed 20261107. Selected audio is probed and fully decoded with ffmpeg. The common supplied paragraph is preserved; every clip is spoken English, with first-language cohorts kept separate from census home language.

The frozen selection includes 10 Canadian-born English baseline recordings and 10 each from Urdu, Arabic and Mandarin Chinese. Ordered reserves and empty exclusions are stored. A pending run exports null predictions/metrics, cohort completion accounting, a transcript CSV handoff, a listening-review CSV, a request estimate, and separate census context for all 11 wards. Recognition indices remain unavailable. There is no approved active-run.json.

Canonical JSON, atomic writes, source/audio/config/settings hashes, code snapshots and versioned JSON Schema definitions make preparation reproducible. Repeated preparation validates existing pending artifacts and preserves human review edits. Missing artifacts, mixed settings and invented pending results stop the run rather than resetting work.

## Changed paths

- pipeline/lapeace_data/: artifacts.py, dataset.py, pilot.py, metrics.py, wards.py, __main__.py, __init__.py
- config/pilot.json; contracts/v1/offline.schema.json
- pyproject.toml; uv.lock; .env.example; .gitignore; README.md
- tests/data_checks/test_offline.py; tests/metrics/test_metrics.py; test package initializers
- docs/pipeline/offline.md; docs/pipeline/skills.md
- coordination/tasks.json and the three task handoffs

Ignored runtime artifacts are under data/raw/, data/derived/, .venv/, and coordination/claims/. Prior documentation and unrelated workspace changes are preserved. No application/UI scaffold was created.

## Verification actually run

- uv lock; uv sync --locked: environment installed successfully with Python 3.12.16.
- uv lock --check --offline: lock is current.
- uv run --offline python -m lapeace_data prepare --source '<local source>': passed on the actual ZIP, then repeated with identical manifest bytes and preserved review queue.
- validate and export-wards CLI stages: passed on actual data; ward details agree with the corrected source.
- transcribe --dry-run: passed with Python socket access disabled; zero network/provider calls.
- uv run --offline python -m unittest discover -s tests -p 'test_*.py': 40 tests pass. Tests use temporary synthetic fixtures only; media decoding in fixtures is mocked and real decoding is separately verified above.
- Draft202012Validator.check_schema and generated artifact validation: passed.
- uv run --offline python -m compileall -q pipeline/lapeace_data: passed.
- git check-ignore: raw/derived data, environment, build metadata and claims are excluded.
- Source ZIP hash after execution matches the initial manifest source hash. No derived audio copies were generated.

The test agent found two rerun settings-identity gaps; the coordinator fixed them, and the regression cases now pass. Full app/provider integration checks are not applicable to this offline scope.

## Data and provider accounting

Source ZIP SHA-256: db3bd4f8469a7302d5c6c2d013661a065c3cd6b90728fc8930a113828e4c4052  
Manifest SHA-256: 22373a9a40beaebc2eddcb3c4a8814b7ab3e8c194ff2388643e811546e1fb6f0  
Manifest: data/derived/pilots/22373a9a40beaebc2eddcb3c4a8814b7ab3e8c194ff2388643e811546e1fb6f0/manifest.json  
Pending run ID: pending-22373a9a40beaebc  
Referenced archive files checked: 468  
Selected and decoded clips: 40  
Estimated initial submitted duration: 1162.857331 seconds (19 minutes 23 seconds)  
Estimated initial requests: 40 against caps of 45 attempts / 1800 seconds  
Actual paid requests/submitted duration: 0 / 0 seconds  
Human review: all 40 pending; common references are not yet listening-verified

Speech Accent Archive attribution and CC BY-NC-SA 4.0 terms accompany manifests. City of Mississauga census attribution accompanies the context export. The newly attached README was read and matches the source README byte for byte.

## Contract scope and remaining work

The current user explicitly authorized offline work ahead of full T00 application scaffolding. Only the offline data portion of schema version 1.0.0 is materialized; API models, TypeScript types and service contracts are not frozen. T00 and the original live T70 remain incomplete. The original T10 queue task is not marked done by this narrower milestone.

The first two installed skills match the pipeline: mle-workflow is applied now; official ElevenLabs speech-to-text is reserved for future authorized Scribe work. An optional data-quality-frameworks candidate is documented without installing extra frameworks.

No live adapter, review-import/versioning CLI, score/import command or approved demo-export command is implemented. Pure metric functions and regression tests are ready for later real outputs. Editing review_queue.csv records human work but does not change approval in the frozen manifest. Source corruption/reference overrides need a new recorded manifest version before paid work. No automatic substitutions are made.

## Next handoff

Murtada opens data/derived/pilots/22373a9a40beaebc2eddcb3c4a8814b7ab3e8c194ff2388643e811546e1fb6f0/review_queue.csv and begins listening/reference review. Hisham can build against runs/pending-22373a9a40beaebc/transcripts.csv as a pending-data handoff; it contains no measured predictions. Current team allocation is Murtada pipeline, Hisham application, Bahar/Jaya UI.

Final implementation source-tree digest at verification: 3751fc3437ffaae3b45f29a5a97185b111fdeba8da46861518dd01c9785f0247. Initial preparation/run snapshots retain their original generation code provenance on reruns.
