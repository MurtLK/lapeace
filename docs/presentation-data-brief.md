# LAPEACE — presentation data brief

Prepared November 8, 2026. This is the evidence handoff for the teammate making the presentation. Chart PNGs and editable aggregate data are in [presentation-assets](presentation-assets/). A separate shareable ZIP also includes two original dataset audio examples and the source-pack licence notes.

## The story to tell

**We studied three connected questions: does speech recognition preserve what was said, does the resulting text reach the right intent, and where do the relevant language communities live?**

We found transcription differences in a small accented-English pilot, and routing decisions changed when we replaced supplied request transcripts with recognized audio. We connected the accent findings to corrected census counts to build an exploratory ward index. Our proposed ElevenLabs service flow adds clarification and explicit confirmation before simulated routing.

These are separate experiments with different recordings and model profiles. Do not combine them into one overall language score or claim a causal accent effect.

## 1. Understood: accented English

**Data:** 40 Speech Accent Archive recordings, 10 per first-language cohort. Everyone speaks **English** and reads the same paragraph. We compared original Buzz/Whisper predictions with the friend's corrected references. The exact original Whisper model/settings are unknown; an unchanged profile was confirmed by Murtada.

| Speaker's first language | Recordings | Word error rate (WER) | Character error rate (CER) |
|---|---:|---:|---:|
| Canadian English baseline | 10 | 2.76% | 1.58% |
| Urdu | 10 | 4.58% | 2.25% |
| Arabic | 10 | 10.47% | 6.47% |
| Mandarin Chinese | 10 | 18.94% | 11.27% |

**Meaning:** WER counts word substitutions, deletions and insertions divided by reference words; CER applies the same idea to characters. Lower is better. These are corpus totals, not averages of clip percentages, percentages of residents who fail, or direct measures of intent understanding. Number formatting can contribute to errors because our normalization does not convert digits to words.

**Suggested spoken line:** “In our 40-recording English-speech pilot, transcription error rates differed across first-language cohorts. This is a small descriptive result, not proof that language or accent alone caused the differences.”

**Real audio example:** `saa:urdu7`. The corrected reference contains “blue cheese”; the original Buzz output contains “blue sheet.” The ZIP's `audio/urdu7.mp3` is the original recording, not generated speech. Retain source attribution.

Chart: [accent word errors](presentation-assets/01-accent-word-error.png). Editable values: [accent-cohorts.csv](presentation-assets/accent-cohorts.csv).

## 2. Routed: recognition can change the destination

**Data:** MInDS-14 contains 1,050 real phone-quality banking requests, five source locales and 14 intent labels. We froze 687 training examples and 348 test examples, excluding 15 duplicates. A simple example-matching router got **309/348 (88.79%)** correct from supplied test transcripts. This larger test is text-only.

For the speech comparison, we selected a separate **40 held-out recordings**: eight per locale, with address changes, balance requests, card freezing and bill payment represented. They were not router training examples. All 40 were transcribed locally in **Buzz 1.4.5 with multilingual Whisper Tiny**, automatic language detection and one recorded settings profile. We kept the original outputs untouched.

### Main paired finding — use these numbers together

| Same 40 requests; same frozen router | Correct route | Wrong route | Clarification requested |
|---|---:|---:|---:|
| Input: supplied source transcript | 37/40 — **92.5%** | 3 | 0 |
| Input: Buzz/Whisper Tiny transcript | 24/40 — **60.0%** | 7 | 9 |

That is a **32.5 percentage-point difference** on the same examples. All transcription jobs completed; the 16 requests without a correct route were seven wrong destinations plus nine clarification outcomes, not 16 crashed jobs. Fourteen requests changed from source-text-correct to STT-incorrect/clarified, one changed the other way, 23 were correct in both modes and two were wrong in both.

Do not compare 88.79% on the larger 348-text test directly with 60% on the 40-audio pilot. The matched comparison is **92.5% versus 60.0% on the same 40**.

| Source locale (8 recordings each) | Correct from supplied text | Correct after STT | Wrong route after STT | Clarify after STT |
|---|---:|---:|---:|---:|
| English | 8 | 8 | 0 | 0 |
| Spanish | 8 | 7 | 0 | 1 |
| Polish | 6 | 4 | 2 | 2 |
| Portuguese | 7 | 2 | 3 | 3 |
| Mandarin Chinese | 8 | 3 | 2 | 3 |

**Suggested spoken line:** “On the same 40 requests, our router completed 37 correctly using supplied transcripts and 24 using locally recognized speech. This shows why a voice pipeline should clarify uncertainty and confirm meaning before routing.”

**Real audio example:** Spanish sample `minds14:570b69f0fb9b85e8ca46fc6a`. Source text: “muéstrame el saldo de mi cuenta corriente.” The dataset's English translation is “show me the balance of my checking account.” Original Whisper Tiny output: “accurately.” Expected intent: `balance`; routing outcome after STT: `clarify`. The ZIP includes the original recording as `audio/spanish-balance.flac`. The English translation is for explanation; it was not a router input.

**Limits:** eight recordings per locale; a small ASR model; automatic language detection; a simple router; possible source-reference errors; and unknown speaker overlap. Locale is not verified spoken language—the source pack documents some English speech in non-English locale folders. These are banking requests, not 311 calls. No municipal routing or ElevenLabs accuracy is measured here.

Chart: [paired routing](presentation-assets/02-paired-routing.png). Editable values: [routing-paired.csv](presentation-assets/routing-paired.csv).

## 3. Where: census context and the exploratory ward index

**Data:** corrected Mississauga 2021 Census ward counts. The three selected home-language categories total **60,835 covered home-language speakers** across the ward table: Urdu 22,535; Arabic 20,570; Mandarin 17,730. These are census population counts, not an estimate of misunderstood people. Census home language and archive first language describe different things. Archive recordings have not been matched to specific Mississauga ward residents; the join is a group-level proxy.

**Calculation:** take each selected cohort's excess WER above the Canadian English baseline, clip that contribution to 0–1, then weight it by that group's share of the three covered home-language populations in each ward. Multiply the weighted result by 100. This index uses the **accent experiment**, not the banking routing scores.

| Ward | Exploratory index | Covered home-language speakers | Coverage of top-14 nonofficial home-language speakers |
|---|---:|---:|---:|
| 1 | 11.85 | 795 | 21.23% |
| 2 | 10.23 | 2,055 | 40.06% |
| 8 | 8.81 | 6,865 | 54.18% |
| 9 | 8.80 | 4,940 | 50.93% |
| 4 | 8.44 | 7,005 | 38.39% |
| 6 | 8.31 | 9,010 | 42.32% |
| 7 | 8.20 | 7,375 | 37.52% |
| 3 | 7.93 | 2,910 | 28.45% |
| 5 | 7.45 | 4,870 | 22.02% |
| 10 | 6.59 | 10,515 | 60.34% |
| 11 | 6.42 | 4,495 | 33.87% |

**Suggested spoken line:** “Ward 1 has the highest exploratory index, while Ward 10 has the largest covered population. We show both the index and population coverage because those answer different planning questions.”

Ward 10 uses the corrected table. An index of 11.85 is **not** a prediction that 11.85% of residents will be misunderstood. This is a research-prioritization proxy based on small archive cohorts and incomplete language coverage, not a ranking of actual city-service performance.

Chart: [ward index and population](presentation-assets/03-ward-context.png). Editable values: [ward-context.csv](presentation-assets/ward-context.csv).

## 4. What ElevenLabs contributes — distinguish current evidence from the demo

**Verified:** the ElevenLabs Scribe adapter passed a separate two-clip live smoke test. That confirms adapter operation, not multilingual service accuracy. Our reported accent/routing benchmarks above use Buzz/Whisper; they are not ElevenLabs failure rates or a measured improvement from ElevenLabs.

**Proposed service flow:** select a reviewed language → transcribe the request with ElevenLabs → ask for missing/unclear details using spoken prompts → show the interpreted request → obtain explicit confirmation → produce a simulated routing receipt.

The frontend, integrated two-language service interaction and final fallback rehearsal still need verification. Present the flow as working only after it has actually been demonstrated. It does not contact the City or submit a real ticket. Call it a custom Scribe/TTS flow unless ElevenLabs Agents has actually been integrated.

## Six-slide outline

1. **Problem:** language access matters when public services use voice interfaces. State our three research questions.
2. **Understood:** play the original English clip; show reference versus recognition and the accent WER chart.
3. **Routed:** show the matched 37/40 versus 24/40 comparison, plus a real request example. Explain wrong route versus clarification.
4. **Where:** show the exploratory ward chart with population/coverage; contrast Ward 1's index with Ward 10's covered count.
5. **Proposed fix:** demonstrate the reviewed ElevenLabs clarification/confirmation flow once integrated. Have an explicitly labelled cached fallback.
6. **Limits and takeaway:** small descriptive pilots, model limits, banking/municipal mismatch and incomplete coverage. A useful next step is to evaluate whether the reviewed clarification/confirmation flow improves completion on new consented service scenarios.

## Claims to keep accurate

- Say “in our pilot,” not “all voice AI” or “all Mississauga residents.”
- Say “Urdu/Arabic/Mandarin first-language speakers reading English” for the accent test. We did not test those native languages in that experiment.
- The 468-row corrected-reference CSV was an input; it was not a completed 468-recording recognition benchmark. Two separate 40-clip experiments supply the accent and speech/routing findings.
- A clarification outcome is incomplete routing, but it is different from sending a caller to the wrong destination. We have not measured how a later clarification turn recovers those requests.
- There is no population-wide significance or causal language/age/gender conclusion. MInDS speaker-independent evaluation cannot be confirmed from this pack.
- FLEURS and Speech-MASSIVE were not evaluated. Speech-MASSIVE was inventoried only. Urdu and several other major communities still lack native-language service-request coverage in the supplied request datasets.
- Toronto's 500,269 requests in 2025 provide service-category context; they are not Mississauga ward demand.
- **100 software tests pass.** That validates pipeline behavior, not an accuracy target or a completed application.

## Sources, methods and traceability

- Speech Accent Archive: Weinberger (2015), George Mason University, [accent.gmu.edu](https://accent.gmu.edu), CC BY-NC-SA 4.0. Use noncommercial presentation attribution and retain the supplied licence notes with shared audio/data.
- MInDS-14: PolyAI, Gerz et al. (2021), [dataset](https://huggingface.co/datasets/PolyAI/minds14), CC BY 4.0.
- Corrected 2021 Census counts: City of Mississauga Open Data, [data.mississauga.ca](https://data.mississauga.ca); source-pack corrected ward table, including rebuilt Ward 10.
- Toronto Open Data 311 2025: Open Government Licence - Toronto; context only. See source-pack `LICENSES.md`.
- Methods: [accent/ward guide](pipeline/buzz.md), [routing guide](pipeline/routing.md).
- Accent/ward run: `buzz-23b598a3485a2ac4d864fd27`. Audio/routing run: `routing-b34949971eb811df5a73f317`. Larger text-only baseline: `routing-70dfbaf4b49a098efeb3214a`.
- Chart source hashes and full-precision values: [chart-data.json](presentation-assets/chart-data.json). Keep the original reference/prediction roles and model labels when editing slides.
