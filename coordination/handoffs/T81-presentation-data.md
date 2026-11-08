# T81-presentation-data handoff

Human owner/coordinator: Murtada. Agent/runtime: `/root`, Codex. No delegation.
Claim/run: `t81-presentation-data-20261108`.
Branch: `murtada/offline-data-pipeline`; base `49407e50f292ef66adc39ffbae05d93c33bcdc42`.
Status: presentation evidence brief and shareable assets completed for review. No frontend or slide-deck implementation was started; no external message was sent to the unspecified teammate.

## Delivered

- `docs/presentation-data-brief.md`: copy-ready story, all measured accent WER/CER, paired routing and ward tables, six-slide outline, two real audio examples, source credits, method distinctions and claims to avoid. It separates the two 40-recording experiments, the larger 348-text test and the proposed ElevenLabs service demo. It identifies the exact original accent model as unknown and the new routing model as Whisper Tiny, and does not claim model fairness, native-language accent-test results or measured municipal outcomes.
- `docs/presentation-assets/`: three 1920x1080 PNG charts, three editable aggregate CSVs, full-precision chart/source-hash JSON and usage notes. The ward plot presents index and covered population side by side and retains coverage; it does not estimate misunderstood residents.
- Shareable ZIP at `data/derived/presentation-brief/LAPEACE-presentation-data.zip`: brief, charts, aggregates, detailed methods, two source audio examples (original Urdu-first-language English MP3 and original Spanish request FLAC), a PCM-equivalent WAV for slide playback, exact example text/outcomes, licence notes and provenance. Audio is not in Git. The ZIP is intended for the user to pass to the teammate; no sending tool was used.
- README links to the presentation brief. Coordinator registry records this documentation task separately from implementation work.

## Evidence sources

Accent/ward run: `buzz-23b598a3485a2ac4d864fd27`.
Paired speech/routing run: `routing-b34949971eb811df5a73f317`.
Larger text-only baseline: `routing-70dfbaf4b49a098efeb3214a`.
Charts and aggregate tables were generated directly from the saved summaries/wards; chart JSON retains source file hashes. Original input audio hashes were checked before/after copying. Both chosen examples' reference/prediction text was read from the stored results, not invented.

## Checks performed

- Visually inspected every generated chart. Adjusted the ward chart's wrapped axis label and spacing, then re-inspected the revised image.
- Verified CSV/JSON values and the brief's rounded tables against saved results, image dimensions, source hashes, relative documentation links, task JSON, ZIP integrity and source audio identity.
- Decoded the Spanish FLAC and its WAV conversion to signed 16-bit PCM and verified equal PCM hashes; the original source file remains unchanged. The brief/package retain source licences and identify the original and converted versions.
- Ran `git diff --check`. No software runtime behavior changed; the preceding 100-test pass is historical validation, not a rerun claim for this documentation task.
- Plotting used Matplotlib in a temporary `uv --no-project --with matplotlib` environment. Repository dependencies and lockfile were not changed. No API calls, credentials, private recordings or source-dataset edits were involved.

## Limits and next handoff

Teammate can insert the chart PNGs or rebuild editable charts from the aggregate CSVs, use the suggested slide outline, and play the two attributed public-dataset examples. She must retain sample sizes/model labels and distinguish observed research from the still-unverified integrated ElevenLabs demo. This task does not establish the frontend, service interaction, statistical significance or production deployment.
