# How well does Scribe transcribe Mississauga's home languages?

FLEURS read speech · ElevenLabs Scribe v2, language set per clip · 560 of 560 clips scored (40 per language) · CER = character error rate

| Language | Clips | Recorded gender | Median CER | Mean CER | Clips > 5% CER* | Median CER, adjusted* |
|---|---|---|---|---|---|---|
| Punjabi | 40 | all F | 3.2% | 7.7% | 11 | 2.8% |
| Hindi | 40 | 25 M / 15 F | 2.5% | 5.5% | 15 | 2.4% |
| Urdu | 40 | all F | 2.4% | 4.4% | 11 | 2.2% |
| Tamil | 40 | 22 M / 18 F | 2.1% | 4.1% | 9 | 1.8% |
| Gujarati | 40 | 27 M / 13 F | 1.4% | 2.3% | 4 | 1.4% |
| Arabic (Egyptian) | 40 | all F | 1.3% | 2.5% | 7 | 0.9% |
| Tagalog | 40 | all M | 0.7% | 1.5% | 2 | 0.7% |
| Cantonese | 40 | 24 F / 16 M | 19.1% † | 19.3% † | 10 | 0.0% |
| Mandarin | 40 | 25 M / 15 F | 0.0% | 2.7% | 9 | 0.0% |
| Portuguese (BR) | 40 | all M | 0.0% | 1.6% | 5 | 0.0% |
| Polish | 40 | 33 M / 7 F | 0.0% | 1.0% | 5 | 0.0% |
| English (US) | 40 | 26 F / 14 M | 0.0% | 0.8% | 3 | 0.0% |
| Spanish (LatAm) | 40 | 30 M / 10 F | 0.0% | 0.6% | 0 | 0.0% |
| Vietnamese | 40 | all M | 0.0% | 0.6% | 3 | 0.0% |

\* Adjusted: Chinese compared in Simplified script on both sides; clips where digits vs spelled-out numbers
differ ("80%" vs "eighty percent") excluded (1–3 per language). "Clips > 5%" uses the Simplified-script CER.
† Scribe writes Simplified characters; the FLEURS Cantonese reference is Traditional.

- **What we did:** Ran all 560 FLEURS clips (same 40 sentences in 14 home languages) through Scribe v2 with
  each clip's language set explicitly, no hints, and scored the character error rate against the human reference.
- **What we observed:** 10 of 14 languages had a median under 1.5%. Hindi, Punjabi, Urdu and Cantonese
  had the most clips over 5% (10–15 of 40). Much of Hindi's error is English loanwords written in Latin script
  ("call", "satellite"), and Cantonese's raw 19% is a script mismatch. Neither is a mishearing.
- **What limits it:** Read sentences, not phone calls or Mississauga residents. No speaker IDs (likely a few
  speakers per language), and Punjabi, Urdu and Arabic are all-female while Tagalog, Portuguese and Vietnamese
  are all-male. Separate from our accented-English benchmark, so don't compare the two.

**Example (needs a fluent Punjabi listener):** `pa_in_1555`, Punjabi, language set to Punjabi.
Reference: ਚਰਚ ਦੇ ਪਰਿਸਰ ਵਿੱਚ ਕੁਝ ਕਬਰਾਂ ਉੱਤੇ ਕੁਝ ਕਬੂਤਰਾਂ ਦੀਆਂ ਦਿਲਚਸਪ ਸੰਗਮਰਮਰ ਦੀਆਂ ਮੂਰਤੀਆਂ ਹਨ।
Scribe: Църквите в перисъл изкуч кавра, у те куч кавутери биле девчас ки самарна диня мортиня.
Scribe wrote the Punjabi sounds in Cyrillic and still reported "Punjabi, probability 1".
