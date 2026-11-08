# Murtada: run the offline pipeline

Run preparation from the project folder. Your job is the pipeline; Hisham owns the application, and Bahar and Jaya own the UI.

This milestone prepares a reproducible pilot. It makes **zero provider requests**. Transcripts and error rates stay pending until real Scribe output exists.

## Run it

1. **Check prerequisites:** Python 3.12, `uv`, `ffmpeg`, and `ffprobe`. They are available on Murtada's current machine.
2. **Install the locked environment once.** This setup step may download dependencies.

   ```sh
   uv sync --locked
   ```

3. **Prepare the dataset offline.** Allow about one minute on this machine; the first run also extracts the required sources.

   ```sh
   uv run --offline python -m lapeace_data prepare \
     --source "/Users/murtadalakhdar/Downloads/Datasets/ElevenLabs Track - Mississauga Unheard"
   ```

4. **Open `data/derived/offline-pilot.json`.** Its `manifest_path` identifies the frozen pilot. The parent folder contains `review_queue.csv` and `dry-run.json`.
5. **Review one clip first.** Use its `source_relative_path` beneath the pointer's `dataset_root`; listen while reading `reference_raw` in `manifest.json`. Record the reviewer, status, and any mismatch in `review_queue.csv`.

On another machine, replace `--source` with the local pack directory, ZIP, or extracted dataset root. Alternatively set `LAPEACE_DATASET_SOURCE` in the shell. `.env.example` documents the variable; the CLI does not load `.env` automatically.

## What the files mean

| File inside the frozen pilot folder | Purpose |
|---|---|
| `manifest.json` and `manifest.sha256` | Fixed selection, audio hashes, source metadata, reference, settings, reserves, and attribution |
| `review_queue.csv` | Listening and reference review log; every clip starts pending |
| `runs/pending-…/transcripts.csv` and `results.jsonl` | Handoff structure for Hisham; prediction and metric fields are empty/null |
| `wards.json` | Corrected census context for 11 wards; recognition indices remain null |
| `dry-run.json` and `preparation.json` | Estimated request/audio budget and preparation provenance |

The configured pilot selects 10 recordings each from English, Urdu, Arabic, and Mandarin Chinese first-language cohorts. The English baseline is Canadian-born. **Every recording is spoken English**, so the planned transcription hint is `en`.

Selection uses seed `20261107`, sorted recording IDs, and a fresh seeded shuffle per cohort. Selected clips are fully decoded with ffmpeg. Census home language and archive first language remain separate measures. Ward 10 uses the corrected table and language percentages use `population_language_base`.

`origin=provider` on a pending run describes its intended result source; `status=pending`, `request_count=0`, and `evidence_status=unmeasured` establish that no provider evidence exists yet. There is no approved `active-run.json`.

## Other offline commands

`validate` checks required inputs and hashes without selecting a pilot. `select` creates the frozen pilot and pending handoff. `prepare` also exports census context. `export-wards` requires `--manifest` pointing to that frozen manifest.

To repeat the request estimate, replace the quoted placeholder with `manifest_path` from the pointer:

```sh
uv run --offline python -m lapeace_data transcribe --dry-run \
  --manifest "/absolute/path/to/frozen/manifest.json"
```

For the original pending manifest, `transcribe` still only estimates and refuses `--live`. After [review import](benchmark.md), it can plan a two-clip smoke test or execute a separately approved live plan. `score` processes saved raw results without credentials or new provider calls. Approved demo/ward-index promotion remains future work.

The estimate prints to the terminal and does not write beside the manifest. Omitting `--dry-run` still defaults to this same offline estimate. For `export-wards`, the manifest must be inside the chosen `--output-dir` (the default is `data/derived/`) and outside the source pack. All stages preserve valid review edits and reject malformed sheets, incomplete pending bundles, or altered existing ward data before updating the pilot pointer.

## Review gate

Keep the source pack unchanged. Work from ignored `data/raw/` extracts and keep generated full artifacts in ignored `data/derived/`. Source and derived archive material retain their attribution and CC BY-NC-SA 4.0 terms.

Do not edit the frozen manifest to approve or replace clips. The CSV records review work; use `review-import` to validate it and create a new immutable manifest. Explicit coordinator attestations can also approve the unchanged references while recording who supplied the confirmation. A corrupt recording or reference correction needs a documented reason, Murtada's sign-off, and a new version before paid work. Poor recognition is never a reason to replace a sample.

## Current MLE experiment

| Item | Decision |
|---|---|
| Goal and owner | Murtada prepares traceable inputs so the team can later compare Scribe errors on one English passage |
| Data contract | One archive recording per stable sample ID; preserved reference, audio hash, first language, spoken language, and review status |
| Acceptance now | Reproducible selection, decodable selected media, source provenance, valid artifacts, pending results, zero provider requests |
| Observation ledger | This preparation establishes inputs; it establishes no model accuracy, cohort difference, or service improvement |
| Next experiment | After all selected references are reviewed, run two bounded Scribe smoke clips and check whether the saved raw outputs can be traced and scored correctly |

Next: open `data/derived/offline-pilot.json` and locate `review_queue.csv` in its manifest's folder.
