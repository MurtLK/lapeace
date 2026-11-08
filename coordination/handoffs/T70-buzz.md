# T70-buzz handoff

Human owner/coordinator: Murtada. Agent/runtime: `/root`, Codex. No delegation.
Claim/run: `t70-buzz-existing-20261108`.
Checkout: `/Users/murtadalakhdar/.t3/projects/lapeace`, branch `murtada/offline-data-pipeline`.
Base commit: `f95d146f39b0bff06c39a8b2e8803796dcc68c65`.
Status: implemented, actual existing-output evaluation generated, ready for review and app integration.

## User-established input roles

Murtada confirms the supplied `saa_transcripts_cleaned_with_wer_ser.csv` transcript column is his friend's corrected reference text. Original model predictions remain the existing 40 Buzz text exports. He identifies the engine as Whisper and confirms one unchanged model/settings profile across all 40 original outputs. Exact model/version/decoding settings are unknown and remain null. The friend is attributed as `Murtada's friend (name not provided)`; timestamps record confirmation receipt, not an invented listening time. This is human/coordinator attestation, not independent agent listening.

The reference CSV contains 468 unique known archive IDs and no empty normalized references or group mismatches; all selected 40 are included. Every supplied WER reproduces against the common source paragraph, and SER matches an any-word-error indicator per whole recording. Those old scores do not evaluate the original Buzz output against the corrected reference and are ignored. Only the frozen 40 are scored; no inference or result is invented for the other 428 rows.

## Delivered behavior

- `import-buzz` validates the frozen dataset/audio bindings, full reference CSV and exact original output per selected ID. It snapshots original input bytes, versions corrected references through the existing review importer, records profile/reviewer provenance, and exports scores and ward results without credentials or network.
- The new import has content-addressed identity and an exclusive operator lock. Identical reruns retain their attestation timestamp and reproduce results. Changed inputs create a different identity; changed saved snapshots are rejected.
- `score` recognizes imported runs and validates their input, manifest, review, audio and source hashes before reproducible WER/CER calculation.
- Corpus scores sum edits and reference denominators. Empty original predictions count as all deletions, not failed requests. Historical generation times and request IDs remain null.
- `recognition_context` applies the spec's clipped excess-WER/population weighting with corrected Ward 10 and deterministic sorting. Missing/inconsistent profile confirmation, incomplete reviews/counts, and fixture evidence leave all indices null. Population and coverage stay separate from the index.
- `ImportedRun` and `EvaluatedWards` are additive schemas. Existing offline `Run`/`Wards` definitions are unchanged; existing results/summary contracts are reused.
- A standalone interactive WER/CER chart was generated from the actual summary, visually checked with `html_preview`, and kept with ignored runtime outputs.

## Actual evidence and accounting

Run ID: `buzz-23b598a3485a2ac4d864fd27`.
Run directory: `data/derived/imported/provider/23b598a3485a2ac4d864fd27c0f1884c274761783b30e5087d826388cdcd9402/`.
Source CSV SHA-256: `76529a57a21249a1b0857ebe0b61d19f67a71cbb18276c321233b9b392d7cd2a`.
Original manifest SHA-256: `22373a9a40beaebc2eddcb3c4a8814b7ab3e8c194ff2388643e811546e1fb6f0` (unchanged).
Corrected manifest SHA-256: `0dd23f89fc6fe744ecb9f8d722727567c50182194a96c9e4b5e2a5d035646a1d`.
Review receipt SHA-256: `48c807b95eb6271894c0d10c50665dfc52cf918342897233e86fcf761a4a754d`.
Profile hash: `9e94575e13c610369bf86b14c2391da5f28e581b58543ab24e7e1f2a556499d4`.

All 40 adjacent staged MP3s match their frozen source hashes. All 40 observations scored successfully, 10 per cohort. WER/CER: Canadian English 2.7616% / 1.5768%, Urdu-first-language 4.5845% / 2.2488%, Arabic-first-language 10.4668% / 6.4678%, Mandarin-first-language 18.9383% / 11.2686%. Every clip is spoken English. These are Buzz/Whisper findings only.

Eleven ready ward records cover 60,835 residents in the fixed three home-language groups. The largest exploratory index is Ward 1 (11.8463), with 795 covered residents and 21.2283% coverage of its top-14 nonofficial home-language population. Largest covered population is Ward 10 (10,515), whose corrected index is 6.5905. These are descriptive proxy calculations, not population-wide recognition rates or counts of residents who will fail a voice service.

**New paid/API requests: 0; submitted audio: 0 seconds.** Import and rescore ran with socket creation blocked. The separate ElevenLabs ledger still contains exactly the earlier two approved smoke attempts. Those raw outputs and their prior reference/score identity were preserved and are not pooled with the revised Buzz evaluation. No claim of measured improvement by ElevenLabs is supported by this run.

## Changed paths

Added `pipeline/lapeace_data/imported.py`, `contracts/v1/imported.schema.json`, `tests/data_checks/test_imported.py`, `docs/pipeline/buzz.md`, and this handoff. Extended `__main__.py`, `artifacts.py`, `wards.py`, README, benchmark guide and `.spec.md`. Coordinator updated the task registry. Runtime input snapshots, reviewed manifest/receipt, results and chart stay under ignored `data/derived/`. No source dataset, original Buzz export, credential, unrelated Word output or Hisham app file was modified.

## Verification actually run

- `uv run --offline python -m unittest discover -s tests -p 'test_*.py'`: **89 tests passed**, including nine new import/index checks. Synthetic fixtures and blocked sockets only; no provider requests.
- New checks cover reference-vs-prediction direction and ignored supplied scores; weighted corpus rates; empty successful predictions; immutable/deterministic reruns; unknown model metadata; missing/duplicate/malformed reference rows and exports; changed audio/source; tampered snapshots/profile; symlink/source protection; CLI scoring dispatch; index formula, sorting and profile/completion/fixture gates.
- `uv run --offline python -m compileall -q pipeline/lapeace_data`: passed.
- `uv lock --check --offline`: passed; no dependencies added.
- `git diff --check`: passed before publication.
- Actual `import-buzz` through the CLI produced 40 scores, four cohorts and all 11 ward indices with sockets blocked.
- Actual offline rescore reproduced all saved run/manifest/result/summary/ward/CSV hashes exactly. A separate full-matrix Levenshtein calculation independently verified word edit counts and denominators for all 40 clips. All 11 ward index formulas were independently reconciled to their contributions.

## Consuming handoff and limitations

Hisham receives `manifest.json`, `run.json`, `results.jsonl`, `summary.json`, `transcripts.csv`, `wards.json`, and `wards.csv` from the explicit run directory above. `results-chart.html` is an optional standalone explanation. Load the imported schemas rather than labelling this Buzz run with the historical selection config's planned ElevenLabs model. Details and rerun commands are in `docs/pipeline/buzz.md`.

No approved `active-run.json` has been promoted and no app integration or deployment is claimed. Hisham still owns app wiring and the ElevenLabs service demonstration. Small samples, unrecorded exact model settings, human reference quality, speaker/recording differences and number formatting limit inference. Original sources/licences remain attributed; source-derived bulk artifacts remain outside Git. The supplied data and these references do not demonstrate service-intent success or a causal accent effect.
