<img src="assets/icon.svg" width="64" height="64" alt="">

# LAPEACE

Created in [T3 Code](https://t3.codes).

LAPEACE is a Sheridan Datathon 2026 project for the ElevenLabs Mississauga Unheard track. It connects measured speech recognition gaps to language communities and a simulated multilingual service interaction.

## Project documents

- [Objective](Objective.md): project direction and scope.
- [Product requirements](PRD.md): user journeys and release acceptance criteria.
- [Technical specification](.spec.md): architecture, dataset handling, metrics, data contracts, and API behavior.
- [Agent playbook](.agent.md): assignments and coordination across coding tools.
- [Completion checklist](docs/release-checklist.md): completed pipeline evidence and remaining app, voice demo, integration and submission work.
- [Presentation data brief](docs/presentation-data-brief.md): slide-ready findings, chart images, editable numbers, source attribution and claim limits.
- [Agent entry point](AGENTS.md): instructions to read before implementation.
- [Task registry](coordination/tasks.json): dependency queue and actual implementation status.
- [Source project plan](docs/references/LAPEACE%20ElevenLabs%20Project%20Plan.md): retained team plan.

## Current state

The Python pipeline validates the source pack, freezes a reproducible 40-clip pilot, versions reviewed references, and scores saved predictions. The original 40 Buzz/Whisper outputs have now been evaluated against the friend's corrected reference CSV, with WER/CER, four cohort summaries and an exploratory 11-ward census index exported locally. Exact Whisper model/settings remain unknown; one unchanged profile was confirmed by Murtada. No further transcription is required. The separately authorized two-clip ElevenLabs adapter smoke succeeded; its evidence remains separate. Application/UI wiring and the ElevenLabs service demonstration remain separate work.

The separate Routed research extension evaluates a held-out MInDS-14 text-routing baseline and a user-approved 40-request local Buzz/Whisper Tiny audio pilot. It exports paired supplied-text versus speech-to-text routing outcomes and preserved original outputs. Banking results and Toronto service-demand context remain separate from the accent/census findings and the ElevenLabs application demonstration.

## Run the offline pipeline

Prerequisites: Python 3.12, [uv](https://docs.astral.sh/uv/), and `ffmpeg` / `ffprobe` on PATH. Install the locked Python dependencies once; subsequent pipeline stages use no network or credentials.

```sh
uv sync --locked
uv run --offline python -m lapeace_data prepare --source '/Users/murtadalakhdar/Downloads/Datasets/ElevenLabs Track - Mississauga Unheard'
uv run --offline python -m unittest discover -s tests -p 'test_*.py'
```

On another machine pass its dataset path or export `LAPEACE_DATASET_SOURCE`. `.env.example` documents this variable; `.env` is not loaded automatically. The source remains unchanged. ZIP extraction, full manifests, and results stay under ignored `data/raw/` and `data/derived/`.

Open `data/derived/offline-pilot.json` to find the original immutable selection and its historical pending bundle. The measured Buzz handoff uses an explicitly identified run under `data/derived/imported/`; see the Buzz guide below for its path and schema. Original pending artifacts remain unchanged. The pipeline creates no approved `active-run.json` automatically.

- [Murtada's short pipeline guide](docs/pipeline/offline.md)
- [Review import, ElevenLabs smoke test, and scoring](docs/pipeline/benchmark.md)
- [Existing Buzz outputs, corrected references, measured results and Hisham's handoff](docs/pipeline/buzz.md)
- [Routed path: held-out intent baseline and the next audio evaluation](docs/pipeline/routing.md)
- [Skills matched to the pipeline specification](docs/pipeline/skills.md)

Murtada owns the pipeline, Hisham owns the application, and Bahar/Jaya own UI work. The older planning documents retain some previous assignments; the current user allocation takes precedence. The `1.0.0` data contracts include the offline schema plus benchmark/review and imported Buzz/ward extensions in `contracts/v1/`. API/UI/service contracts and the full T00 scaffold remain separate unfinished work.
