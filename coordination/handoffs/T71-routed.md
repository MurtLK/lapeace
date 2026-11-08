# T71-routed handoff

Human owner/coordinator: Murtada. Runtime: `/root`, Codex. No delegation.
Claim/run: `t71-routed-20261108`.
Branch: `murtada/offline-data-pipeline`; base `4a3687013df34853f7acc425b6de72504f278618`.
Status: offline text baseline and the separately approved 40-request local speech/routing evaluation are implemented and verified; ready for review. Municipal app/service integration remains separate.

## Scope and method

The user explicitly requested work on the Routed research path. This task adds a separate MInDS-14 banking intent experiment; it does not modify Hisham's app or merge banking results into the existing accent/census index.

Used the existing MLE workflow skill for a frozen data/metric contract, leakage checks, repeatable evaluation, abstention accounting and provenance. Selected MInDS-14 rather than pooling it with Speech-MASSIVE because its 14 labels have substantially more examples per language/intent. The default classifier is a lightweight native-text character 2–4-gram TF-IDF nearest-example router per locale, with fixed similarity 0.10 and margin 0.02 thresholds. This is an example-matching baseline; no speech model or remote inference was trained or run.

Vocabulary and IDF use training examples only. Expected test intents, encoded filenames/IDs and English translations never enter features. Same normalized text within a locale and same audio bytes globally define duplicate groups. Conflicting groups are excluded; otherwise one canonical representative remains. About two thirds of independent groups per locale/intent train the router; the rest test it. Seed and all settings were fixed before the actual accuracy was inspected, and were not tuned afterward.

## Delivered files and commands

- `routing.py`: source/audio validation, duplicate-aware frozen split, separate 311 context validation and Speech-MASSIVE inventory, offline router, intent metrics/confusion matrices, reference-text baseline and external-STT import evaluation.
- `config/routing.json`, `contracts/v1/routing.schema.json`: explicit settings and additive operator schemas.
- CLI: `routed-prepare --dataset-root ...`, `routed-score --pilot-dir ... [--predictions-csv ...]` and `routed-import-buzz --pilot-dir ... --buzz-dir ... --model-id ... --settings-json ...`; these pipeline commands do not submit audio or load credentials. The separately authorized local Buzz CLI invocation generated the actual STT evidence.
- The audio import requires exactly the planned 40 IDs/audio hashes, original successful/failed STT status and text, a recorded model and settings hashes consistent within locale. Missing/pending/duplicate IDs, mismatched audio, mixed models and inconsistent locale settings are rejected. Provider failures count separately; successful empty text asks for clarification.
- `routed-import-buzz` preserves original export bytes and settings in a hashed receipt, validates bindings and produces the STT CSV automatically. Paired summary fields retain source-text metrics on the exact same examples and correct/incorrect transition counts.
- `docs/pipeline/routing.md`: reproducible commands, exact artifacts, methods, measured text and audio results. Updated README/spec/release checklist; added eleven routing tests and this handoff.

Runtime artifacts stay under ignored `data/derived/routed/`. Source root is the full pack already present in Downloads, because the earlier ignored extraction intentionally contains only accent/census sources. No source audio or table was changed or copied into Git.

## Actual evidence

Pilot/manifest SHA-256: `9e70d966ad40afa74410d6f768ac191fd9fb79efd69603cbf1718f4c53322944`.
Final text run: `routing-70dfbaf4b49a098efeb3214a`.
Measured audio run: `routing-b34949971eb811df5a73f317`.
Run directories are under `data/derived/routed/9e70d966ad40afa74410d6f768ac191fd9fb79efd69603cbf1718f4c53322944/runs/`.

Actual source accounting: **1,050 = 687 training + 348 test + 15 duplicate exclusions**. No conflicting-label exclusion was needed. All 14 intents and five source locales are represented. End-to-end provider/voice accuracy is not established by these results.

| Source locale | Test count | Correct | Wrong route | Clarify | Text accuracy |
|---|---:|---:|---:|---:|---:|
| en-US | 70 | 59 | 5 | 6 | 84.29% |
| es-ES | 70 | 66 | 2 | 2 | 94.29% |
| pl-PL | 70 | 61 | 5 | 4 | 87.14% |
| pt-PT | 69 | 63 | 3 | 3 | 91.30% |
| zh-CN | 69 | 60 | 7 | 2 | 86.96% |

Overall: 309 correct, 22 wrong routes, 17 clarifications, 88.79% accuracy, 95.11% routing coverage, 93.35% accuracy among routed requests, macro F1 0.9084 across 14 represented gold labels. Per-locale full confusion matrices and original input text are in the runtime results. An observed English bank-card-not-working request was misrouted to business loan; it is an error of this simple baseline, not evidence about municipal service performance.

The audio pilot uses two held-out requests for each of address/balance/freeze/pay_bill in each of five locales: **40 clips, 354.167375 seconds**. All 40 passed probing and full decoding. Murtada explicitly approved running this new batch locally in Buzz, separately from the earlier accent clips. Neutral-filename staged copies were hash-verified before processing.

All forty local jobs completed successfully once, with no failed jobs or resubmitted clips, using Buzz 1.4.5's CLI, multilingual OpenAI Whisper Tiny (20250625), PyTorch 2.8.0, CPU/FP32, automatic language detection, empty initial prompt, no speech extraction or word timestamps. Temperature fallback was `[0, 0.2, 0.4, 0.6, 0.8, 1.0]`; CPU thread environment was limited to four. Cached model weights SHA-256: `65147644a518d12f04e32d6f3b26facc3f8dd46e5390956a9424a650c0ce22b9`. Each process and child had network denied by macOS sandbox. No model download, API credentials or remote inference was needed. The installed CLI help and official v1.4.5 source were inspected. Read-only Buzz DB verification confirmed all 40 jobs' completed status/model/options.

Raw exports/settings/attempt receipts are at `buzz-exports/`, `buzz-settings.json`, `buzz-progress.json`, `buzz-db-verification.json` and `buzz-logs/` under the pilot. Import receipt: `buzz-imports/bc87a128649c6aca4b8fd1501264b011b3de90f0fe0c79f2ba6aeed6eb25c54d/`. Original text was not edited or rewritten before scoring; its hashes match the successful job receipts.

## Paired audio results

The same 40 requests routed correctly **37/40 from supplied text versus 24/40 after local Whisper Tiny STT**. Source text produced three wrong routes and no clarifications; STT produced seven wrong routes and nine clarifications. There were zero failed transcription jobs. Twenty-three were correct in both modes, 14 changed from reference-correct to STT-incorrect/clarified, one changed from reference-incorrect to STT-correct, and two were wrong in both modes. This is a net 32.5 percentage-point completion gap on this frozen sample, not a population estimate.

| Locale (8 clips each) | Source-text correct | STT-routing correct | STT wrong route | STT clarify |
|---|---:|---:|---:|---:|
| en-US | 8 | 8 | 0 | 0 |
| es-ES | 8 | 7 | 0 | 1 |
| pl-PL | 6 | 4 | 2 | 2 |
| pt-PT | 7 | 2 | 3 | 3 |
| zh-CN | 8 | 3 | 2 | 3 |

STT routing coverage was 77.5%, with 77.42% accuracy among routed requests; neither replaces the 60% all-request completion rate. Macro F1 is 0.7390 on the four gold-supported pilot intents. The classifier still has all 14 possible output classes. No samples, thresholds, router training examples or references were changed after seeing the audio results. Tiny model capacity, auto language detection, short phone recordings, source reference quality and the simple text router all affect these observations; they do not measure general language fairness, ElevenLabs or municipal intent performance.

Toronto context aggregates independently reconcile by division between request types and ward/division summaries: 500,269 requests, 539 type rows. This selects plausible service-demo context, not Mississauga ward demand or a bank-to-city label mapping. Speech-MASSIVE inventory confirms 575 rows, five locales, 18 scenarios and 60 intents; no evaluation on it is claimed.

## Verification actually run

- `uv run --offline python -m unittest discover -s tests -p 'test_*.py'`: **100 tests passed** after the final source change. Eleven new routing cases cover splits, duplicate/conflicting groups, shared audio across locales, training-only vocabulary, tie/empty abstention, outcome metrics, original-STT imports/failures, source/hash/profile validation, CLI dispatch, 311 aggregate consistency, and byte-preserving Buzz conversion/paired metrics. Synthetic fixtures use `origin=fixture` and fake media inspection; actual media validation is separately recorded above.
- `compileall`, `uv lock --check --offline` and `git diff --check`: passed; no dependencies added.
- Actual prepare/score/rescore ran with Python socket creation blocked. A deterministic rerun reproduced all saved pilot/run hashes; source accounting, train/test audio/group disjointness, training-example bindings, all five confusion/accuracy totals and all 40 pilot IDs/durations/decode statuses were independently checked.
- Run creation timestamps record actual evaluation creation time; cached rescoring retains original code/Git provenance. Documentation selects final runs explicitly. Saved-output evaluation is reproducible; regenerating Whisper output can vary because the decoder uses temperature fallback.
- Existing ElevenLabs ledger still contains exactly two historical attempts. **New API/paid requests: 0; remotely submitted audio: 0 seconds. Local Buzz jobs: 40, 354.167375 source-audio seconds.** Existing accent reference/transcription and ward artifacts remain separate.

## Limits and next step

Source locale is not verified spoken language; ten non-English-locale clips are documented as English. Source references may contain transcription errors. No MInDS speaker IDs exist in this pack, so speaker-independent evaluation cannot be asserted. Sample/reference/speaker differences prevent interpreting per-locale results as causal language or accent effects. Fourteen closed-set banking classes do not validate open-domain city routing. The original source references and source licences remain authoritative.

The approved local audio experiment is complete. Hisham can consume the explicit audio run's `results.csv`/JSONL and `summary.json`, alongside its source-text paired metrics and input receipt. Keep it distinct from the original accented-English ward evidence. App/service integration and municipal scenario review remain Hisham's separate work; any future provider run needs its own bounded approval.
