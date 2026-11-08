# LAPEACE Product Requirements

Version 1.0 · November 7 2026 · Implementation baseline

## Product decision

Build a local web prototype for the ElevenLabs Mississauga Unheard track. A judge should be able to hear a real recording, inspect a measured transcription error, see the relevant language population across Mississauga wards, and try a service interaction that asks for clarification and confirms the request.

The first release focuses on voice access. Voice phishing detection is a later workstream with separate data and evaluation requirements. No recognition, routing, fairness, or fraud detection results have been established yet.

This PRD defines user behavior and acceptance criteria. [.spec.md](.spec.md) defines implementation contracts; [.agent.md](.agent.md) defines task ownership and agent coordination. The supplied [project plan](docs/references/LAPEACE%20ElevenLabs%20Project%20Plan.md) supplies the named team allocation and pilot proposal; [Objective.md](Objective.md) supplies the project direction.

## Problem and intended users

Voice systems can misunderstand speech or service intent. The challenge is to investigate these gaps using the supplied human speech recordings and Mississauga census data, then demonstrate how ElevenLabs can improve a service interaction.

| User | Needs to do | Successful outcome |
|---|---|---|
| Datathon judge | Follow evidence from audio to community context to prototype | Can reproduce the example and distinguish results from assumptions |
| Resident trying the demo | Explain one service request in a supported language | Gets clarification and an explicit confirmation before simulated routing |
| Team reviewer | Audit samples, settings, references, and results | Can trace each displayed number to a run and source |
| Presenter | Run the demonstration when credentials or connectivity fail | Can replay labelled cached evidence without invented analysis |

The resident flow is a simulated service experience. It does not contact the City, place calls, create municipal tickets, verify identities, or provide emergency support.

## Release scope

### Required for the foundation release

- Evidence view with sample selection, audio playback, raw reference and model transcripts, error metrics, and provenance.
- A reproducible pilot of 40 Speech Accent Archive recordings: 10 Canadian English baseline speakers and 10 speakers in each of three census-prioritized first-language groups.
- An 11-ward ranking with corrected census inputs, population counts, measured group results, coverage, and a visible explanation of the exploratory index.
- One simulated missed-waste-collection interaction with language selection, clarification, explicit confirmation, and a simulated routing receipt.
- English and at least one additional language whose demo prompts and expected behavior have a fluent reviewer. Disable languages that have not passed that review.
- Live transcription and synthesized prompts through ElevenLabs when configured; honest replay and unavailable states when it is not.
- Source attribution, limitations, accessible navigation, and a repeatable local setup.

### Later work

FLEURS multilingual benchmarks, request-intent evaluation, neighbourhood views, a geographic map if valid boundary data is obtained, additional scenarios, and a full ElevenLabs Agents integration are optional after the foundation works. A ranked ward table satisfies the geographic requirement without acquiring new map data.

Phishing detection, acoustic deepfake classification, identity or speaker matching, automatic phone monitoring, real municipal submission, accounts, cloud deployment, and production authentication are outside this release.

## User journeys and acceptance criteria

### Evidence view

**FR01** A user selects a reviewed sample, plays the source recording, and sees the reference alongside the actual model output. The view distinguishes spoken language from the speaker's first language. Every Speech Accent Archive clip is spoken English.

**Acceptance:** Each pilot record exposes its source, sample ID, first-language cohort, model and settings identifier, run timestamp, reference status, and source audio hash through a details panel. Audio is served by sample ID. Missing or failed results show a status and null metrics, never a fabricated transcript or zero error.

**FR02** Show per-clip and per-cohort WER and CER, with completed and failed sample counts. Explain that these measure transcript edits and do not establish intent understanding or caller legitimacy. Retain error values above 100% when insertions make that possible.

**Acceptance:** A stored run can reproduce the displayed metrics without another paid request. Baseline and comparison cohorts use the same model settings and normalization version. Fixture data is visibly marked and excluded from reported findings.

### Ward view

**FR03** Show 11 Mississauga wards with covered home-language population, selected-cohort coverage, and the exploratory recognition gap index defined in the spec. Show the population knowing neither official language as context, not an extra unvalidated multiplier.

**Acceptance:** The view identifies Ward 10 as corrected. No ranking is published until all four pilot cohorts are complete. Missing evidence produces an unavailable index rather than zero. Counts describe census language populations; the interface does not estimate residents who will fail a service interaction by multiplying population by WER.

**FR04** Selecting a ward reveals the cohort weights, measured cohort errors, Canadian English comparison, and limitations behind its index. Clearly distinguish census home language from the archive's first-language cohorts and identify incomplete language coverage.

**Acceptance:** The calculation can be reproduced from exported aggregate results. Ward ordering is stable for ties. Toronto service records never appear as Mississauga ward demand.

### Simulated service interaction

**FR05** A user selects an enabled language and chooses a reviewed scenario recording or supplies a short consented recording. The application transcribes a turn, asks for missing information, and presents the interpreted request for confirmation. Text controls remain available for confirmation and cancellation.

**Acceptance:** Three scenario tests pass: a complete request, an ambiguous request requiring clarification, and a provider failure. Unknown requests lead to a clarification or manual-service suggestion. A cancellation never produces a routing receipt. A receipt appears only after explicit confirmation and says that no real request was submitted.

**FR06** Synthesized prompts use reviewed text in the selected language. The first implementation is a custom turn-based Scribe → constrained service flow → text-to-speech pipeline. Do not label it as an ElevenLabs Agents integration unless that product has actually been integrated.

**Acceptance:** English and one reviewed additional language complete the flow. If speech output fails, the reviewed text remains visible with a retry option. Interpretation corrections clear any earlier confirmation.

### Availability and trust

**FR07** Label live, cached provider result, scripted replay, fixture, and unavailable states where they matter. Replay accepts only its declared scenario assets; it never pretends to analyze new microphone or upload content.

**FR08** Keep provider keys on the backend. Validate files, bound request size and duration, obtain explicit consent before sending a recording to ElevenLabs, and delete temporary resident audio. Show provider processing as distinct from local file deletion; do not promise third-party zero retention.

**FR09** All three views work with keyboard navigation, labelled controls, readable contrast, and visible loading and error states. No status depends only on color. Screen-reader text identifies transcripts, audio controls, and simulated receipts.

## Evidence and evaluation

Start with Urdu, Arabic, and Mandarin Chinese first-language cohorts, the three largest home-language groups in the supplied coverage table with enough accent recordings, plus the Canadian English baseline. Freeze the selected sample IDs before transcription. Changes require a recorded reason; poor model performance is never a reason to remove a clip.

The pilot is descriptive. It uses a common English paragraph, is small, and does not represent the full population or municipal calls. Show cohort sample counts and error differences without claims of statistical significance, accent fairness, avoided abandonment, or proven service improvement.

The ward index is a research prioritization aid, not a probability, individual assessment, or estimate of affected residents. Preserve raw WER/CER; bound only the contribution used by the documented index.

## Team and delivery

| Accountable teammate | Owns | Supporting contribution |
|---|---|---|
| Murtada | Data pipeline, metrics, census joins, and contract review | Reviews Mahar's scripts and data findings |
| Hisham | App, API integration, and simulated voice interaction | Reviews Jayatsi's UI helpers and scenarios |
| Mahar | Source review, sample auditing, and basic validation scripts | Hands reviewed records and exclusions to Murtada |
| Jayatsi | Scenario content, user testing, and presentation | Hands scenario expectations and issue logs to Hisham |

Agents implement scoped tasks under these human owners. A provider name is not a person or a task owner. Mahar and Jayatsi can complete review work without coding, then take small scripts or UI helpers with lead review.

Delivery order: freeze contracts and scaffold; run data, API, and interface tasks in parallel; review the pilot; generate real results and ward summaries; integrate the service flow; run the release checks. Task IDs, dependencies, and launch briefs live in the agent playbook and task registry.

## Release checklist

- [ ] Forty reviewed pilot recordings have real provider results under one recorded settings profile; failures and substitutions are accounted for.
- [ ] Normalization and metric tests pass, including empty output and insertion-heavy transcripts.
- [ ] Eleven corrected ward records reproduce the documented calculation and show language coverage.
- [ ] A judge can play audio and compare the reference, prediction, and measured errors.
- [ ] The service tests pass in English and one reviewed additional language, including ambiguity, cancellation, and provider failure.
- [ ] Cached replay works; missing credentials and fixture-only mode cannot produce apparent measured findings.
- [ ] Credentials, private audio, and the bulk dataset are excluded from Git; attribution and reviewed content are present.
- [ ] Keyboard and error-state review passes; the team rehearses one end-to-end demo and its fallback.

No arbitrary accuracy target determines success. A small or absent group difference is a valid finding. The track weights data insight 40%, effective ElevenLabs use 30%, communication 20%, and feasibility and impact 10%.

## Dataset authority and constraints

The local source is `/Users/murtadalakhdar/Downloads/Datasets/ElevenLabs Track - Mississauga Unheard`. The ZIP contains a nested `Mississauga_Unheard_ElevenLabs_Track/` directory; the pack has not been extracted into this repository. Source files remain unchanged.

The supplied README, DATA_DICTIONARY, and LICENSES govern dataset interpretation and attribution. Use corrected Ward 10 counts, `population_language_base` denominators, and populated neighbourhoods only. Treat the archive and Speech-MASSIVE noncommercial ShareAlike terms as part of artifact handling. Missing request audio for major language communities and differences in dialect, gender coverage, and recording conditions must remain visible.
