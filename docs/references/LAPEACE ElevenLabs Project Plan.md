# **LAPEACE ElevenLabs Project Plan**

## ***Dataset foundation and voice phishing detector roadmap***

**For the four-person LAPEACE team**  \|  Sheridan Datathon 2026 (November 7–8)

We will first build a **small, evidence based prototype** for the ElevenLabs Mississauga Unheard track. It will measure where voice AI misunderstands speech, connect those findings to Mississauga language communities, and demonstrate a clearer multilingual service interaction. The call phishing detector remains a planned extension after this foundation works.

## **The question we need to answer**

Which Mississauga residents are least likely to be understood by voice AI, how many residents may be affected, and where do they live? The supplied challenge then asks us to use ElevenLabs to demonstrate a practical improvement. **These are the core judging questions.** \[1\]

## **What we should build first**

* An audio comparison view with playback, the reference transcript, the model transcript, and measured transcription errors for a small, documented sample.  
* A ward ranking or simple map connecting language population counts to measured recognition gaps. Label it an exploratory Unheard Index, rather than a prediction of individual service failure.  
* One ElevenLabs service interaction that asks for clarification, confirms the request, and responds in the selected language. Demonstrate a municipal scenario such as reporting a missed waste collection.

## **How we will produce the evidence**

* **Builder A**: Run a pilot of 40 Speech Accent Archive recordings (10 Canadian English baseline speakers and 10 speakers from each of three first language groups selected using census coverage).

* **Builder B**: Connect the results to the app and build one ElevenLabs voice interaction.

* **Teammates C & D (Noncoding)**: Review sample quality, select scenarios, test the experience, and prepare the explanation.

* Report **word error rate (WER)** and **character error rate (CER)** alongside sample counts and normalization methods.

* Use additional FLEURS clips or requested audio only after the pilot workflow works.

For languages without a fluent teammate reviewer, retain supplied references and mark meaning reviews as unverified. \[1, 2\]

**Success for the first version:** A judge can hear a real sample, see a measured recognition problem, understand which community it relates to, and try a response that handles uncertainty more clearly.

# **The ElevenLabs dataset foundation**

The track package is a collection of speech and city datasets, rather than an ElevenLabs generated voice database. All supplied recordings are human speech. The package does not supply scam labels, synthetic audio labels, or caller identity verification. Counts below describe the supplied pack, not completed analysis. \[1, 2\]

| DATASET | COVERAGE IN THE PACK | PURPOSE IN LAPEACE |
| :---- | :---- | :---- |
| **Mississauga Census** | 11 wards and 56 neighbourhoods | Choose communities and connect findings to population counts |
| **FLEURS** | 560 clips across 13 home languages plus English | Compare reference sentences with transcription output |
| **Speech Accent Archive** | 468 recordings including 45 Canadian English speakers | Compare accented English with a Canadian baseline |
| **MInDS-14** | 1,050 banking request clips across five language locales | Test intent recognition on phone quality speech |
| **Speech-MASSIVE** | 575 voice assistant commands across five languages | Test intent or scenario recognition |
| **City 311 Records** | Toronto requests from 2025 and Mississauga daily volumes from 2017 and 2018 | Choose plausible service scenarios and describe demand |

## **Files to open first**

Inside the dataset ZIP, start with language\_coverage.csv and geo\_language\_long.csv in 01\_people\_census/derived. Use ward\_language\_profile\_2021\_corrected.csv for ward counts and language\_crosswalk.csv to match language names across sources. The metadata files link each recording to its transcript and labels. \[1, 2\]

## **Data checks that change the conclusions**

* Use the corrected Ward 10 table and population\_language\_base for language percentages. Exclude the 17 zero population neighbourhoods from resident rankings. \[2\]  
* Toronto 311 is a service category proxy. Its records cannot establish Mississauga ward demand, and the older Mississauga call totals cannot establish language caused abandonment. \[1, 2\]  
* FLEURS has few speakers per language and uneven gender coverage. Dialects differ across sources. Report these limits before interpreting a difference as a language or accent effect. \[1\]  
* The request datasets omit Urdu, Punjabi, Tamil, Tagalog, Hindi and Gujarati. MInDS-14 contains banking requests, which must not be presented as labelled municipal calls or verified safe calls. \[1\]

Keep source attribution with the samples. Speech Accent Archive and Speech-MASSIVE have noncommercial ShareAlike conditions; review LICENSES.md before publishing derived data or pursuing commercial reuse. \[3\]

# **The voice phishing detector extension**

The longer term idea is a call assistant that listens to an uploaded or consented recorded call, identifies suspicious requests, and explains when the user should end the call and verify the caller through a known channel. Voice phishing is also called **vishing**. A simulated call player is the recommended first security demo; automatic access to ordinary phone calls is a later integration task.

## **Two separate analyses**

**Scam content analysis:** Transcribe the call and identify evidence such as requests for passwords or one time codes, pressure to transfer money, secrecy, or impersonation. Show the relevant transcript excerpts and explain the warning. A legitimate sounding human voice can still make a fraudulent request.

**Synthetic audio analysis:** Assess whether the audio resembles speech generated by a supported model. This signal concerns how the voice was produced. It cannot establish whether the caller is honest or whether an organization is genuine.

ElevenLabs describes its AI Speech Classifier as a detector for ElevenLabs generated audio. Its official page states that it cannot detect other providers and does not reliably classify Eleven v3. Treat it as an optional research tool with that limited scope. Builder A must confirm supported automation and access before making it an application dependency. \[4\]

## **What the interface should say**

| RESULT | SUGGESTED USER MESSAGE |
| :---- | :---- |
| **Suspicious Content** | End the call and contact the organization through a known official channel. Explain the detected request. |
| **No Indicators Found** | No suspicious indicators were found in this excerpt. Caller identity is still unverified. |
| **Insufficient Evidence** | The clip is too short, unclear, or outside the supported detector scope to assess reliably. |

Keep scam risk and synthetic audio results separate. Show numerical outputs as model scores until calibration on held out examples supports probability claims. **Do not turn a low synthetic score into a percentage chance that a call is legitimate.** Speaker similarity requires a consented reference recording and separate validation; defer it from the first version.

## **Evidence needed before claiming detection performance**

* **Dataset Preparation:** Assemble separately labelled human benign, human scam, synthetic benign, and synthetic scam examples.

* **Scenario Creation:** Noncoding teammates create clearly marked scripted scenarios while investigating external datasets, recording source, licence, provenance, and label definitions.

* **Voice Selection:** Use permitted stock voices or consented recordings rather than cloning dataset speakers.

* **Metrics Separation:** Measure scam precision/recall, benign call false alarms, and synthetic detection errors independently.

* **Dataset Splitting:** Keep speakers and script topics strictly separated between development and test sets.

**Fairness Evaluation:** Compare false alarm rates across accents and languages with explicit sample counts (noting pilot size limits).

# **Responsibilities for four teammates**

Assign roles across the team to balance experience and skills. **Murtada and Hisham act as the experienced lead vibecoders (Builders A and B)**, owning core system implementation and architecture. **Mahar and Jayatsi (Teammates C and D)** assist with simpler coding tasks—such as basic data cleaning scripts, validation checks, formatting datasets, or writing simple UI helpers—to help them refine and develop their coding skills while taking ownership of evidence quality, scenario testing, and the user experience.

| TEAMMATE | OWNS | PRIMARY HANDOFF |
| :---- | :---- | :---- |
| **Murtada (Builder A)**Lead Vibecoder | Data and evaluation pipeline | Sample manifest, results file, metric definitions |
| **Hisham (Builder B)**Lead Vibecoder | App and ElevenLabs interaction | Working demo and repeatable setup steps |
| **Mahar (Teammate C)**Assisting / Developing Coding | Dataset review and research | Reviewed sample sheet and source register |
| **Jayatsi (Teammate D)**Assisting / Developing Coding | Scenarios, user testing and presentation | Test log, demo script and submission copy |

## **Murtada (Builder A) owns data and evaluation pipeline**

* **Pipeline & Batching:** Extract dataset packs, validate paths, select pilot samples with Teammate C, and run speech recognition through ElevenLabs Scribe while caching outputs to conserve API credits.

* **Data Logging:** Record dataset source, clip ID, language/accent group, reference text, model transcriptions, hyperparameter settings, error metrics, and review notes.

**Handoffs:** Compute language population metrics and ward rankings using corrected census data; supply a structured results file to Builder B and review rows to Teammate C. \[2, 5\]

## **Hisham (Builder B) owns the application and interaction**

* **Interface & Layout:** Build sample selection views, audio playback, side-by-side transcript comparison, error metrics display, and the ward map overview.

* **Voice Interaction:** Integrate one ElevenLabs voice conversational agent with explicit clarification and confirmation steps.

**System Architecture:** Keep API keys secured server-side, create clear error handlers, build a cached demo fallback, and defer optional security screens until core flows pass validation.

## **Mahar (Teammate C) owns dataset review and basic data scripting**

* **Sample Review & Auditing:** Maintain a shared log spreadsheet and basic validation/formatting scripts to audit pilot clips, file paths, first language, audio quality, reference text, and reviewer notes.

* **Data Cleaning:** Write helper scripts to screen for silent clips, corrupted audio, or metadata mismatches; perform meaning verification for fluent languages.

**Documentation & Handoff:** Review dataset READMEs, license compliance, and maintain the source register. Deliver the shortlist of target language groups and 10 reviewed clips to Murtada.

## **Jayatsi (Teammate D) owns UX, UI helpers, and storytelling**

* **Scenario Design:** Write three municipal service scenarios incorporating expected clarification/confirmation dialog flows, providing helper scripts and copy for Hisham.

* **UX & Quality Testing:** Perform user acceptance testing across app flows, logging interaction steps, expected vs. actual outcomes, and issue severity.

**Storytelling & Handoff:** Draft the problem statement, key findings, slides, and demo narration while selecting reproducible examples. Handoff scenario specifications to Hisham.

**Pairing:** Murtada and Mahar collaborate on data batching and cleaning scripts. Hisham and Jayatsi collaborate on usable screens and UI helpers. Lead builders oversee main implementations while Mahar and Jayatsi refine their coding skills through supporting scripts and UI tasks.

# **Delivery sequence and completion checks**

The following work blocks are planning estimates, not event deadlines. Start with a short pilot, then expand only if the core interaction and evidence are ready. Each handoff has an owner so the two builders can work at the same time.

| WORK BLOCK | TEAM ACTIVITY | EXIT CONDITION |
| :---- | :---- | :---- |
| **First 30 minutes** | A and C choose groups and clips. B and D agree one service journey. | Sample sheet, scenario sheet and results fields agreed |
| **Next 90 minutes** | A runs a small transcription batch. B builds playback and comparison. C reviews samples. D tests copy and flow. | One real clip runs through the full demo |
| **Next 2 to 3 hours** | Finish the pilot, ward ranking and one ElevenLabs response. C checks evidence. D logs failures. | Measured outputs and repeatable service interaction |
| **Final 60 to 90 mins** | Fix failures, cache demo assets, rehearse and package the submission. | Every core completion check passes |
| **After foundation** | Research security labels and detector access, then build the simulated call extension. | Separate security evaluation plan before performance claims |

## **Core completion checks**

* A real clip plays beside its reference and actual model output. Every reported metric includes its sample count and evaluation method.  
* The ward view uses corrected census inputs and explains how the ranking was calculated. It distinguishes measured speech errors from population estimates.  
* One ElevenLabs interaction demonstrates clarification and confirmation. Before and after examples are described as demonstrations unless a matched evaluation supports improvement.  
* C has checked sample provenance and attribution. D has retested the main flow and rehearsed a cached fallback with the builders.

The README weights data insight at 40%, ElevenLabs use at 30%, communication at 20%, and feasibility and impact at 10%. **Prioritize the audio evidence, functioning interaction and clear story before adding security features.** \[1\]

## **Sources**

\[1\] Mississauga Unheard track README, supplied dataset package. Challenge, dataset coverage, judging weights and limitations.

\[2\] DATA\_DICTIONARY.md, supplied package. File structure, corrected Ward 10 counts, census denominators and audio metadata.

\[3\] LICENSES.md, supplied package. Dataset attribution and reuse terms.

\[4\] ElevenLabs AI Speech Classifier. Scope and model limitations checked November 7 2026\. https\://elevenlabs.io/ai-speech-classifier

\[5\] ElevenLabs Speech to Text overview. Scribe transcription capability checked November 7 2026\. https\://elevenlabs.io/docs/overview/capabilities/speech-to-text