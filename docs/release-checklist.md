# Hackathon completion checklist

Checked against this checkout on November 8, 2026. Murtada owns pipeline/data and coordination; Hisham owns the app and voice interaction; Bahar/Jaya support UI. Checked items below have local evidence. Unchecked items require implementation or verification; Hisham may already have work in another branch or checkout.

The target is three working views: **audio evidence → ward context → a simulated multilingual 311 interaction**. A working local prototype and a labelled cached fallback are sufficient for this project's foundation scope. A geographic map and model training are optional.

## Completed foundation — Murtada

- [x] Validate the source data, freeze the 40 selected English-speech clips, and retain source/audio hashes.
- [x] Import the friend's corrected references separately from original Buzz predictions.
- [x] Score all 40 original Buzz/Whisper outputs with WER and CER; export four cohort summaries and preserve raw text/provenance.
- [x] Join corrected census data and export all 11 ward indices, covered populations and language coverage, including corrected Ward 10.
- [x] Implement the budgeted ElevenLabs STT adapter and saved-response scoring; complete the separately authorized two-clip Scribe smoke test.
- [x] Verify the pipeline with 89 passing tests, independent word-edit/index checks and reproducible offline rescoring.
- [x] Publish pipeline changes in [PR #1](https://github.com/MurtLK/lapeace/pull/1).

Current evidence is `buzz-23b598a3485a2ac4d864fd27`; [the Buzz handoff guide](pipeline/buzz.md) gives the exact artifact directory, schemas and commands. It contains 40 scored clips and 11 wards. No further transcription is required to complete this evaluation. The other 428 CSV rows contain supplied reference text, not newly established model results.

## 1. Integrate the app and choose its evidence — Murtada + Hisham

- [ ] Get Hisham's current branch/PR and bring his app into the integrated checkout. There is currently no `web/` or `server/` directory here; his progress elsewhere is unverified.
- [ ] Agree on the artifact interface: load `ImportedRun` and `EvaluatedWards` from `contracts/v1/imported.schema.json`, alongside the existing sample/result/summary definitions. Keep TypeScript/backend types consistent.
- [ ] Add an explicit reviewed demo-run selection (`active-run.json` or the agreed documented loader) for the one validated Buzz run. Do not select runs by modification time or pool them with Scribe smoke results.
- [ ] Make setup and app start/build commands work from a clean checkout plus locally configured data. Keep raw audio/generated artifacts out of Git; document how to regenerate or transfer the required ignored evidence bundle.

Done when: the backend and frontend start, load the selected run, and show a truthful unavailable state when its evidence is missing.

## 2. Connect the evidence screen — Hisham + UI

- [ ] Serve allowlisted sample audio by sample ID and expose sample, transcript, cohort and provenance data through the local API.
- [ ] Let a judge select a clip, play it, and compare corrected reference with original Buzz prediction side by side.
- [ ] Display per-clip WER/CER and per-cohort corpus WER/CER, sample counts, and the Canadian English comparison. Show understandable error examples.
- [ ] Label the model as Buzz/Whisper with exact model/settings unknown. The unchanged profile is a user attestation. Do not use the selection manifest's planned ElevenLabs settings as the actual evaluated model.
- [ ] Show first language separately from spoken language: **all 40 clips are spoken English**. Include visible limitations and source attribution.

Done when: a judge can trace one displayed error from source audio through both texts to its score, without a new API request.

## 3. Connect the ward screen — Hisham + UI; Murtada reviews the numbers

- [ ] Load and display all 11 exported ward records in stable ranking order. A ranked table satisfies the current scope; a map can follow later.
- [ ] Show the index, covered home-language population, coverage of the top-14 nonofficial language population, and the population knowing neither official language as context.
- [ ] Show each ward's Urdu/Arabic/Mandarin population weights and their measured excess WER over the baseline. Explain the index calculation and identify corrected Ward 10.
- [ ] Explain that the index is an exploratory prioritization measure. It is not a count or probability of residents who will be misunderstood, and census home language is different from archive first language.
- [ ] Handle missing evidence as unavailable, rather than substituting a zero index. Do not use Toronto 311 counts as Mississauga ward demand.

Done when: a judge can choose a ward and understand both its ranking and the population/coverage limits behind it.

## 4. Finish one reviewed service scenario — Hisham + a fluent reviewer

- [ ] Choose one missed-waste-collection scenario with English plus one additional language for which a fluent reviewer is available. Disable unreviewed languages.
- [ ] Write and review prompts, expected request fields, clarification questions, confirmation text, cancellation text and a simulated receipt.
- [ ] Provide three scenario cases: a complete request, an ambiguous/incomplete request, and provider failure. Also verify cancellation and correction after interpretation.

Done when: the supported languages have reviewed content and an agreed expected outcome for every scenario case.

## 5. Implement the ElevenLabs service interaction — Hisham

- [ ] Connect the backend to Scribe for a turn's speech-to-text and ElevenLabs TTS for reviewed spoken prompts. The pipeline adapter smoke does not establish that the application's voice flow works.
- [ ] Implement `request → clarify missing details → show interpreted request → explicit confirmation → simulated receipt`. A correction clears prior confirmation; cancellation produces no receipt.
- [ ] Keep text confirmation and cancellation available. Unrecognized requests ask for clarification or offer manual-service guidance.
- [ ] Configure a permitted voice and model; check spoken prompt quality in both enabled languages. Call it a custom Scribe/TTS flow unless ElevenLabs Agents itself is actually integrated.
- [ ] Keep the key backend-only, obtain consent before provider submission, validate/bound recordings, delete temporary resident audio, and enforce the documented service budget/timeouts.
- [ ] Define a separate bounded live demo test, obtain its authorization, and verify the two-language flow. Existing approval covers only the earlier two benchmark clips; it does not authorize new live demo requests.

Done when: both reviewed languages complete the flow, a missing field triggers clarification, and the receipt explicitly says no real city request was submitted.

## 6. Add the presentation fallback — Hisham + UI

- [ ] Keep benchmark evidence available from saved outputs without API keys or connectivity.
- [ ] Prepare reviewed scenario assets and a labelled scripted replay of the service interaction. Replay only its declared assets; arbitrary microphone input must not appear to receive live analysis in replay mode.
- [ ] Show live, cached, scripted replay and unavailable modes clearly. If TTS is unavailable, preserve the reviewed text and provide an explicit retry or fallback.

Done when: the demo remains understandable without connectivity, with no invented transcript or hidden paid retry.

## 7. Verify the integrated product — both builders + human reviewers

- [ ] Pass the frontend build, relevant API/UI tests, and the pipeline checks. Default automated tests make no paid requests.
- [ ] Walk through evidence → ward → service using the actual selected run. Reconcile displayed values to the exported files.
- [ ] Test complete request, clarification, cancellation, corrected interpretation, missing key, provider error, upload/microphone failure and missing cached assets.
- [ ] Check keyboard controls, audio labels, loading/error states, readable contrast and text alternatives. Record language-review/UAT results and unresolved issues.
- [ ] Review and integrate the PRs; verify that source data, credentials and personal recordings remain excluded from Git.

Done when: the integrated local app passes a repeatable end-to-end rehearsal and its fallback rehearsal.

## 8. Finish the story and submission — team

- [ ] Prepare a short presentation: the access problem, one audible transcription example, the measured cohort findings, geographic context, the ElevenLabs interaction, and limitations.
- [ ] Give the ElevenLabs demonstration real attention: judging weights are data insight 40%, ElevenLabs use 30%, communication 20%, feasibility/impact 10%.
- [ ] Describe clarification/confirmation as the prototype's demonstrated behavior. Recognition scores do not measure caller intent, prove a causal accent effect, or establish a statistically measured improvement from ElevenLabs.
- [ ] Include the exact run, sample counts, unknown Whisper metadata, normalization, corrected Ward 10, source licences and census/archive mismatch in the method/limitations notes.
- [ ] Prepare the final README, screenshots or demo recording, team credits and the event's required submission materials; rehearse who presents each part.

Done when: a judge can follow the evidence, see one working improvement mechanism, reproduce the numbers, and understand what has and has not been measured.

## Optional after the foundation works

Neighbourhood or map views; FLEURS multilingual benchmarking; intent evaluation on MInDS-14/Speech-MASSIVE; additional service scenarios; a full ElevenLabs Agents integration; further model comparisons. Model training, real municipal submission, and the deferred phishing work are outside the current foundation scope.

## Plugin setup requested alongside this checklist

Registered the `vibe-wise` Codex marketplace from `nykooi1/vibe-wise` and verified it with `codex plugin marketplace list`. Marketplace registration and plugin installation are separate operations. To install VibeWise from that registered marketplace:

```sh
codex plugin add vibe-wise@vibe-wise
```

Then start a new Codex session and invoke `$vibe-wise:learn` when learning mode is wanted. These are user-local tools, not project release dependencies. See the [VibeWise instructions](https://github.com/nykooi1/vibe-wise#codex) and [official OpenAI marketplace documentation](https://developers.openai.com/plugins/build/plugins#add-a-marketplace-from-the-cli).
