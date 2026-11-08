# Routed research path

This extension asks whether a request reaches its labelled **banking intent**, independently of the accented-English transcription benchmark. It uses the provided MInDS-14 recordings and native reference transcripts. It does not change Hisham's application, invent city routing labels, or add intent errors to the existing ward index.

## What is implemented

1. `routed-prepare` validates MInDS source metadata and all referenced FLAC signatures/hashes, freezes a deterministic training/test split, inventories Speech-MASSIVE separately and reconciles Toronto 311 aggregate totals.
2. `routed-score` builds one simple example-matching router per source locale, then evaluates held-out **source transcripts**. It produces accuracy, macro F1, routing coverage, accuracy among routed requests, separate wrong-route/clarification counts and full intent confusion matrices.
3. A separate 40-recording audio pilot has now been transcribed locally in Buzz after explicit user approval. Original outputs are preserved and routed with the same frozen training examples, producing paired reference-versus-STT outcomes. An STT import template and direct Buzz importer support repeatable evaluation without another transcription.

The actual text baseline and its tests require no credentials, downloads, new packages or API requests. Development fixtures explicitly retain `origin=fixture`; real source-pack runs use `origin=dataset`. `mode=reference_text_baseline` is never presented as end-to-end voice accuracy.

## Method fixed before inspecting results

Configuration: `config/routing.json`, seed `20261108`. Fourteen banking intents in five locales (`en-US`, `pl-PL`, `pt-PT`, `es-ES`, `zh-CN`). About two thirds of independent groups per locale/intent build the router; the remainder are held out. Equal normalized native text within a locale and identical audio bytes globally form duplicate groups. One canonical recording represents a valid group; additional duplicates are retained as explicit exclusions. Conflicting label/locale groups are excluded entirely. Every source record is accounted for.

Input normalization uses Unicode NFC/casefold, punctuation-to-space and whitespace collapse. Each router compares character 2–4-grams with TF-IDF and cosine similarity. Vocabulary/IDF come only from its training transcripts. The highest-scoring example per intent supplies the candidate; similarity below 0.10 or a lead below 0.02 over the second intent returns `clarify`. Those thresholds were fixed before the real test run and were not tuned to its results. Similarity is not a calibrated probability.

Features contain **only the request text**. Test labels, filenames (which encode intent), sample IDs, annotations and English translations are not classifier inputs. A known source locale chooses the corresponding router; language detection is not evaluated. MInDS provides no speaker ID in this pack, so unseen-speaker generalization cannot be established. Source transcriptions can contain errors. Ten requests in non-English locale folders are documented as actually English; locale results are not verified spoken-language results.

Accuracy counts clarification and failed STT as incorrect completion. Routing coverage is the fraction assigned an intent. Accuracy among routed requests excludes abstentions/provider failures, so it must always be displayed alongside coverage. Macro F1 averages the gold-supported intents in that evaluation set; `macro_f1_labels` makes the scope explicit. The reference test covers all 14 intents; the audio pilot covers four. Neither is an open-domain city-service evaluation.

## Reproduce the current baseline

The previous `data/raw/` extraction contains only the accent/census milestone. Use the full local pack, including `04_spoken_requests/` and `05_city_311_requests/`:

```sh
uv run --offline python -m lapeace_data routed-prepare \
  --dataset-root '/Users/murtadalakhdar/Downloads/Datasets/ElevenLabs Track - Mississauga Unheard/Mississauga_Unheard_ElevenLabs_Track'
```

Use the returned `pilot_directory`:

```sh
uv run --offline python -m lapeace_data routed-score --pilot-dir /absolute/path/to/routed/pilot
```

Sources remain read-only. The pilot is content-addressed under ignored `data/derived/routed/<manifest hash>/`. It contains `manifest.json`, `preparation.json`, `audio-plan.json` and `stt-import-template.csv`. Raw reference text and gold labels live in the manifest. Runs under `runs/<run id>/` contain `run.json`, `summary.json`, `results.jsonl` and `results.csv`. Run identity covers the frozen manifest, input mode, any STT import hash and the pipeline/config/schema source hash. Identical rescoring preserves the original run provenance across Git commits. A code/input change produces a new run rather than silently replacing prior findings.

Current pilot: `9e70d966ad40afa74410d6f768ac191fd9fb79efd69603cbf1718f4c53322944`.
Current text run: `routing-70dfbaf4b49a098efeb3214a`.
Accounting: 1,050 source recordings = 687 training + 348 test + 15 excluded duplicate recordings. No conflicting-label exclusions were required in this actual pack.

| Source locale | Held-out requests | Correct | Wrong route | Clarify | Accuracy |
|---|---:|---:|---:|---:|---:|
| English (`en-US`) | 70 | 59 | 5 | 6 | 84.29% |
| Spanish (`es-ES`) | 70 | 66 | 2 | 2 | 94.29% |
| Polish (`pl-PL`) | 70 | 61 | 5 | 4 | 87.14% |
| Portuguese (`pt-PT`) | 69 | 63 | 3 | 3 | 91.30% |
| Mandarin Chinese (`zh-CN`) | 69 | 60 | 7 | 2 | 86.96% |
| **Total** | **348** | **309** | **22** | **17** | **88.79%** |

Overall macro F1 is 0.9084; coverage is 95.11%, and accuracy among routed requests is 93.35%. These describe a simple classifier receiving supplied transcripts, not voice AI receiving audio. Separate locale-specific training sets, reference quality and speaker differences limit comparisons. Do not interpret the ordering as an accent/language fairness finding.

## Audio pilot: paired recognition and routing evaluation

The frozen audio pilot selects two held-out recordings from each of `address`, `balance`, `freeze`, and `pay_bill` in each locale: **40 clips, 354.167375 seconds (about 5 minutes 54 seconds)**. All 40 were probed and decoded successfully during preparation. They are already excluded from training. Source references and expected labels must not be sent as prompts to a speech recognizer.

Murtada explicitly approved running these new 40 request recordings locally in Buzz. Executed Buzz 1.4.5's CLI with the cached multilingual OpenAI Whisper **Tiny** model (Whisper 20250625, PyTorch 2.8.0), CPU/FP32, task `transcribe`, automatic language detection, empty initial prompt, no speech extraction or word timestamps. The default temperature fallback was `[0.0, 0.2, 0.4, 0.6, 0.8, 1.0]`. CPU thread environment was limited to four. No output was corrected, translated or rewritten before scoring.

Model weights SHA-256: `65147644a518d12f04e32d6f3b26facc3f8dd46e5390956a9424a650c0ce22b9`. All forty CLI jobs completed once, with no failed jobs or clip resubmissions. Each process and its children ran under a network-denied macOS sandbox; no inference API or new model download was used. Read-only inspection of Buzz's own database confirmed all 40 used Whisper/Tiny, automatic language detection and the same options. Staged audio and original output hashes were rechecked.

Original outputs/settings are under the pilot's `buzz-exports/` and `buzz-settings.json`; the content-addressed import receipt is `buzz-imports/bc87a128649c6aca4b8fd1501264b011b3de90f0fe0c79f2ba6aeed6eb25c54d/`. Local execution receipts, per-clip timestamps/logs, staging map and database verification stay with the ignored pilot artifacts. Saved-output rescoring is deterministic. Fresh STT generation can vary because the decoder fallback includes nonzero temperatures.

Measured audio run: **`routing-b34949971eb811df5a73f317`**. This comparison uses the same 40 clips, not the larger 348-transcript test:

| Source locale | Clips | Correct from supplied text | Correct after Buzz STT | Wrong route after STT | Clarify after STT |
|---|---:|---:|---:|---:|---:|
| English | 8 | 8 | 8 | 0 | 0 |
| Spanish | 8 | 8 | 7 | 0 | 1 |
| Polish | 8 | 6 | 4 | 2 | 2 |
| Portuguese | 8 | 7 | 2 | 3 | 3 |
| Mandarin Chinese | 8 | 8 | 3 | 2 | 3 |
| **Total** | **40** | **37 (92.5%)** | **24 (60.0%)** | **7** | **9** |

Twenty-three requests were correct in both modes, 14 were correct with supplied text but incorrect/clarified after STT, one changed from incorrect to correct, and two were incorrect in both. There were zero failed transcription jobs. End-to-end routing coverage was 77.5%, and accuracy among automatically routed requests was 77.42%. These two conditional metrics must not replace the 60% all-request completion rate.

The observed input change matters on this sample; it is not proof that every error is an acoustic failure or that language causes the differences. Eight clips per locale, automatic language detection, phone recordings, reference errors, a very small ASR model and the simple text matcher all limit interpretation. This does not measure ElevenLabs performance or actual 311 routing. No model, threshold, sample or reference was changed after seeing the audio outcomes. The separately measured accent/census index remains unchanged.

For future approved transcriptions, record a multilingual recognizer's exact model/settings first. ElevenLabs would require a separate bounded plan and approval; the earlier Scribe smoke concerned different recordings. Preparation/import/scoring commands themselves submit nothing.

Fill a **copy** of `stt-import-template.csv` with original, uncorrected recognition outputs. Exact headers:

```text
sample_id,audio_sha256,status,transcript,model_id,settings_sha256
```

All frozen 40 IDs are required, with matching audio hashes. `status` is `succeeded` or `failed`; pending, missing, duplicate or extra rows are rejected. Successful empty text is a valid input that requests clarification; failed STT has empty text and is counted separately as provider failure. Use one model throughout and consistent settings within each locale. `settings_sha256` identifies recorded canonical settings (including any locale-specific language hint), not a secret or unrecorded guessed value. Preserve raw outputs/settings alongside the import. Never copy source references into this prediction column.

```sh
uv run --offline python -m lapeace_data routed-score \
  --pilot-dir /absolute/path/to/routed/pilot \
  --predictions-csv /absolute/path/to/completed-stt-import.csv
```

The resulting `mode=external_stt_routing` run evaluates these 40 only. Each result retains its reference-based decision and correctness alongside the STT-based decision; per-locale summaries show `reference_accuracy_same_examples` for a paired comparison. Provider failures remain failures; no automatic retry or new request occurs. It is not valid to compare these 40 directly with the 348-case baseline as though they were the same sample.

For original Buzz exports, `routed-import-buzz` performs the conversion and scoring directly. Export filenames must begin with the neutral staged ID (`minds14_<opaque ID>`), so original filenames or expected intent labels are not used as recognition prompts. Record the actual model and a nonempty JSON settings object:

```sh
uv run --offline python -m lapeace_data routed-import-buzz \
  --pilot-dir /absolute/path/to/routed/pilot \
  --buzz-dir /absolute/path/to/buzz-exports \
  --model-id openai-whisper/tiny \
  --settings-json /absolute/path/to/buzz-settings.json
```

This snapshots each original TXT byte stream and the original settings file in a content-addressed `buzz-imports/` receipt directory, binds them to the selected audio hashes and produces a validated STT CSV before scoring. No text cleanup or corrections are performed. A repeated or ambiguous export is rejected. Summary fields `reference_overall_same_examples` and `paired_outcomes` support comparison on identical examples, separately from the larger text-only test.

## How Toronto 311 and Speech-MASSIVE fit

The manifest's context validates that the Toronto request-type and ward/division summaries reconcile, yielding 500,269 requests across 539 request-type rows. The top categories help choose realistic municipal demonstration scenarios. These are Toronto counts, not Mississauga ward demand. Banking intent labels are never relabelled as waste/roads/animal-service queues.

Speech-MASSIVE is inventoried (575 rows, five locales, 18 scenarios, 60 intents) but not mixed into MInDS training or evaluation. Its very sparse intent coverage and available speaker IDs warrant a separate speaker-aware experiment. Urdu, Punjabi, Tamil, Tagalog, Hindi and Gujarati service-request evidence remains missing; existing accented-English results do not fill that gap with native-language intent accuracy.

Murtada owns these research artifacts. Hisham can later use the same distinction in the app: STT text → choose a supported service intent or clarify → confirm → simulated receipt. The 311 demo still needs its own reviewed municipal scenario and functional tests; a banking baseline cannot certify it.

Sources: PolyAI MInDS-14, Gerz et al. (2021), CC BY 4.0; Toronto Open Data 311 2025, Open Government Licence - Toronto; FBK Speech-MASSIVE, Lee et al. (2024), CC BY-NC-SA 4.0 (inventory only). See the supplied `LICENSES.md` for attribution and reuse terms.

Buzz operation follows its installed CLI help and [version 1.4.5 CLI/source documentation](https://github.com/chidiwilliams/buzz/blob/v1.4.5/docs/docs/cli.md).
