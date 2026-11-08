# LAPEACE Project Objective

**Event:** Sheridan Datathon 2026, November 7–8  
**Track:** ElevenLabs — Mississauga, Unheard

Identify which Mississauga language communities voice AI struggles to understand, estimate how many residents may be affected and where they live, and use ElevenLabs to demonstrate a clearer multilingual service interaction.

## First version

Build a small prototype that connects speech recognition evidence to city demographics and a working service scenario:

1. **Measure recognition errors.** Compare reference transcripts with model output. Report word error rate (WER), character error rate (CER), sample counts, and the evaluation method. Start with a manageable sample of accented English and Canadian English baseline recordings before expanding to other languages or intent recognition.
2. **Connect findings to communities.** Combine measured recognition gaps with census language counts to produce a ward ranking or simple map. Describe the Unheard Index as an exploratory estimate, with its calculation and assumptions visible.
3. **Demonstrate an improvement.** Prototype one ElevenLabs 311 interaction, such as reporting missed waste collection. Let the caller select a language, ask for clarification when needed, and confirm the request before routing it.

## Data foundation

The supplied pack contains human speech and city data. It does not contain labelled scam calls, synthetic speech, or verified caller identities.

| Source | Available coverage | Project use |
|---|---|---|
| Mississauga 2021 Census | 11 wards and 56 neighbourhoods | Language population counts and geographic context |
| FLEURS | 560 clips in 13 home languages plus English | Multilingual transcription evaluation |
| Speech Accent Archive | 468 recordings, including 45 Canadian English speakers | Accented English comparison |
| MInDS-14 | 1,050 banking request clips | Phone quality transcription and intent evaluation |
| Speech-MASSIVE | 575 voice assistant commands | Intent and scenario evaluation |
| City 311 data | Toronto requests from 2025 and Mississauga call volumes from 2017–2018 | Service scenarios and demand context |

Start with `language_coverage.csv`, `geo_language_long.csv`, and `ward_language_profile_2021_corrected.csv` in `01_people_census/derived/`. Use `language_crosswalk.csv` to join language names across sources.

## Team responsibilities

| Teammate | Responsibility | Deliverable |
|---|---|---|
| Builder A | Data processing, transcription, metrics, and census joins | Reviewed results file and ward ranking |
| Builder B | Application, audio comparison, and ElevenLabs interaction | Working demo with a cached fallback |
| Teammate C | Dataset review, sample selection, and source research without coding | Sample sheet, quality notes, and attribution |
| Teammate D | Scenario writing, user testing, and presentation without coding | Test log, demo script, and submission copy |

Builder A pairs with C to review evidence. Builder B pairs with D to test the user flow.

## Completion criteria

- A judge can play a real recording and compare its reference transcript with actual model output and measured errors.
- The ward view uses corrected census data and explains how the ranking was calculated.
- One ElevenLabs interaction demonstrates clarification and request confirmation.
- The presentation connects the audio evidence, affected communities, and proposed improvement without claiming unmeasured benefits.

Prioritize the track's judging weights: data insight 40%, ElevenLabs use 30%, communication 20%, and feasibility and impact 10%.

## Limits that must stay visible

Use the corrected Ward 10 table, `population_language_base` for language percentages, and exclude zero population areas from resident rankings. Toronto 311 records are a proxy for service categories, not evidence of Mississauga ward demand.

Small samples, speaker differences, dialects, and recording quality limit comparisons. Banking requests are not municipal calls. Report these constraints and follow the attribution and reuse terms in the supplied `README.md`, `DATA_DICTIONARY.md`, and `LICENSES.md`.

## Future security extension

After the foundation works, explore a simulated call phishing detector with separate assessments for suspicious content and synthetic audio. Additional labelled data and evaluation are required. A human sounding voice or low synthetic score does not verify a caller's legitimacy; numerical model scores must not be presented as validated probabilities without supporting evidence.
