# Existing Buzz evaluation

The human-confirmed reference CSV and the original Buzz exports are separate inputs. Murtada confirms that the CSV's `transcript` column contains his friend's corrected reference text, and that all 40 original Buzz outputs used one unchanged Whisper model/settings profile. The exact Whisper model, version, decoding settings and original generation times were not provided; those fields remain unknown. This evaluation is **Buzz/Whisper**, not ElevenLabs Scribe. The separately recorded two-clip Scribe smoke test remains historical evidence and is not pooled into these results.

## Run without another transcription

Use the original pending manifest from `data/derived/offline-pilot.json`, not an already reviewed manifest. Supply the extracted read-only dataset root, the corrected CSV, and the directory containing the original `.txt` exports. The original export names may be `<clip>.txt` or Buzz's `<clip> (transcribed on ...).txt`; exactly one is required for each selected recording. If adjacent MP3s exist, their bytes must match the frozen selection.

```sh
uv run --offline python -m lapeace_data import-buzz \
  --manifest /absolute/path/to/original/pilot/manifest.json \
  --dataset-root /absolute/path/to/extracted/pack \
  --references-csv /absolute/path/to/corrected-reference.csv \
  --buzz-dir /absolute/path/to/original/buzz/exports \
  --reviewer "Murtada's friend (name not provided)" \
  --attested-by Murtada --uniform-settings
```

`--uniform-settings` records a human confirmation, not recovered model metadata. Omit it if the original outputs used mixed settings or their consistency is unknown; scores and census context still export, but ward indices stay null. Fixtures have their own namespace and cannot produce a measured ward index.

The CSV requires unique `audio_file`, `speaker_group` and `transcript` columns. Every row must map to source metadata and have a nonempty normalized reference; all selected 40 must be covered. Additional known-source rows are preserved but not scored. The supplied file has 468 rows and no missing, duplicate or unknown recordings. Its SHA-256 is `76529a57a21249a1b0857ebe0b61d19f67a71cbb18276c321233b9b392d7cd2a`.

The CSV's original WER values all reproduce when comparing its reference text with the common elicitation paragraph. Its SER matches an indicator for any word edit across the entire recording. Neither column measures the original Buzz output against the supplied corrected reference, so both are ignored during import. Recognition WER and CER are recalculated from the two actual text inputs using `en_v1`. Original spelling, punctuation and digit formatting are preserved. The normalizer does not convert digits into words.

## Preserved evidence and outputs

Each content-addressed run lives under `data/derived/imported/<origin>/<identity hash>/`. The identity covers the original manifest, full corrected-reference CSV bytes, every selected Buzz export's raw bytes and audio binding, reviewer/coordinator attribution, evidence origin and model-profile declaration. Input snapshots are immutable; a changed input creates a different run. Identical reruns validate and reuse the same review receipt and run without changing their timestamp.

- `inputs/references.csv`: untouched full CSV, including its unused original score columns.
- `inputs/predictions/*.txt`: exact original bytes for the selected 40 Buzz exports.
- `inputs/review.csv`: attributed overrides with confirmation receipt time, not an invented listening time.
- `run.json`: `ImportedRun`, with provider `buzz`, engine `Whisper`, unknown exact model/settings, profile attestation, input hashes and code provenance. Zero requests means zero requests by this import, not that the historical outputs required no computation.
- `manifest.json`: corrected, accepted 40-sample manifest for handoff; source common references remain preserved in the separately hashed review receipt.
- `results.jsonl`: 40 schema-valid `TranscriptResult` records, including raw original predictions, WER and CER. Request IDs and generation timestamps are null because they were not supplied.
- `transcripts.csv`: sample metadata, corrected reference, original prediction, WER and CER together.
- `summary.json`: schema-valid corpus totals and metrics for all four cohorts. Aggregation sums edits and reference denominators; it does not average percentages.
- `wards.json` / `wards.csv`: 11 corrected census records, covered populations, coverage, contributions and exploratory index. `wards.json` validates against `EvaluatedWards`; the older census-only `Wards` contract still requires null indices.

Repeat scoring from stored inputs without a key or network:

```sh
uv run --offline python -m lapeace_data score --run-dir /absolute/path/to/imported/run
```

This validates the original input hashes, review receipt, reference text, frozen audio/source hashes and run identity before recalculation. Source pack files, existing manifests, Buzz exports, earlier Scribe results and source CSV are never modified. Runtime artifacts remain ignored by Git. No `active-run.json` is promoted automatically.

## Current result and app handoff

Run: `buzz-23b598a3485a2ac4d864fd27`.
Directory: `data/derived/imported/provider/23b598a3485a2ac4d864fd27c0f1884c274761783b30e5087d826388cdcd9402/`.
Corrected manifest: `0dd23f89fc6fe744ecb9f8d722727567c50182194a96c9e4b5e2a5d035646a1d`.
Review receipt: `48c807b95eb6271894c0d10c50665dfc52cf918342897233e86fcf761a4a754d`.
Profile hash: `9e94575e13c610369bf86b14c2391da5f28e581b58543ab24e7e1f2a556499d4`.

| Speaker first language | Completed clips | Word edits / reference words | WER | CER |
|---|---:|---:|---:|---:|
| Canadian English baseline | 10 | 19 / 688 | 2.76% | 1.58% |
| Urdu | 10 | 32 / 698 | 4.58% | 2.25% |
| Arabic | 10 | 74 / 707 | 10.47% | 6.47% |
| Mandarin Chinese | 10 | 132 / 697 | 18.94% | 11.27% |

**All recordings are spoken English.** These numbers describe this 40-recording pilot and this original Buzz run. They do not establish multilingual recognition rates, service-intent accuracy, ElevenLabs performance or population-wide failure rates.

The fixed three comparison groups cover 60,835 home-language residents across the corrected ward table. The index uses `100 * sum(home_speakers * clipped_excess_WER) / covered_home_speakers`, as specified in `.spec.md`. Ward 1 has the largest index (11.85), but only 795 covered residents and 21.23% coverage of its top-14 nonofficial home-language population. Ward 10 has the largest covered count (10,515) and an index of 6.59. An index ranking and a population ranking answer different questions. The index must never be labelled an estimated count or probability of misunderstood residents.

Hisham should consume the explicit run directory's manifest, results, summary and wards together. The original manifest's selection config records the planned ElevenLabs job; **actual evaluation model metadata comes from this imported run**, not that historical planned config. Load `ImportedRun` and `EvaluatedWards` through `contracts/v1/imported.schema.json`, preserving unknown model fields and the run's limitations. The earlier Scribe smoke's references and scores remain unchanged, so they are not a directly comparable improvement claim against these revised references. App wiring, demo selection/promotion and the ElevenLabs service interaction remain separate integration work.
