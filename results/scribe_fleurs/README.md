# FLEURS home-language benchmark (Scribe v2)

Answers: *How well does Scribe transcribe Mississauga's home languages?* Separate from the Speech Accent
Archive benchmark (accented **English**); don't compare the two datasets directly.

## Data
`02_speech_home_languages_FLEURS/metadata.csv`: 560 clips = 40 sentences (`fleurs_id`, same sentence in every
language) x 14 languages, 16 kHz FLAC. Columns used: `file`, `language`, `lang_config`, `variety_note`,
`fleurs_id`, `gender`, `duration_sec`, `raw_transcription` (the human reference = answer key).
**No speaker IDs** are given (the data dictionary says few speakers per language), so unique speakers are
"unknown". Several languages are one recorded gender only: Arabic, Punjabi, Urdu (all female); Tagalog,
Portuguese, Vietnamese (all male).

## Request settings (pipeline/scribe_fleurs/run.js)
`model_id=scribe_v2`, `tag_audio_events=false`, no keyterms, reference never sent. `language_code` set per
clip from the crosswalk, in ISO 639-3 as Scribe requires: eng urd ara zho pan pol yue fil spa tam vie hin por guj.
`cmn` was **rejected** by the API (HTTP 400, invalid language code); Mandarin uses `zho`. Raw responses are cached in
`cache/<clip>.<settings hash>.json`; failures in `failures.jsonl`. Every response's returned `language_code`
matched the code sent. Quick check before scaling: Portuguese -> Latin script, Punjabi -> Gurmukhi, Mandarin -> Simplified.

## Scoring (pipeline/scribe_fleurs/score.js)
Both sides: Unicode NFC, lowercase, punctuation and symbols removed, whitespace collapsed. Accents, diacritics,
combining marks and script are kept; no transliteration.
- **CER (primary)** = character edit distance / reference characters, whitespace removed.
- **WER** = whitespace tokens. Not reported for Mandarin/Cantonese (no documented segmentation). Vietnamese
  tokens are syllables; Tamil words are long (agglutinative), so prefer CER there.
- Flags: returned language != requested; <90% of letters in the expected script.

## Sensitivity (pipeline/scribe_fleurs/sensitivity.py, primary numbers unchanged)
- **Chinese script:** Scribe returns *Simplified* characters for Cantonese; the FLEURS reference is
  *Traditional*. A word-perfect transcript can score ~46% CER. `cer_simplified_both` converts both sides
  with OpenCC t2s (opencc-python-reimplemented 0.1.7).
- **Number format:** "80%" vs "eighty percent" counts as many character errors. Such clips are flagged
  (`number_format_mismatch`) and excluded from `sensitivity_median_cer_pct`.
- **Latin loanwords:** Hindi/Urdu output sometimes writes English loanwords in Latin script ("tariff",
  "course"); counted in `latin_words_in_output`. This is a spelling convention, not mishearing.

## Limits
Read speech of Wikipedia sentences, not phone calls or Mississauga residents. No speaker IDs, so a language's
result may reflect one or two speakers. Errors are not assigned a cause without a fluent listener's review.

## Notable results (full run, 560/560 scored, 0 API failures)
- `pa_in_1555`: Punjabi audio sent with `language_code=pan` came back as **Cyrillic (Bulgarian-looking) text**;
  the response still reported `pan` with probability 1. CER 106%. A wrong-script output under a forced language
  code. Needs a fluent Punjabi listener to check the audio.
- `pa_in_1654`: Gurmukhi output, but the first half doesn't match the reference (CER 44%). Likely a real
  mishearing; needs fluent review.
- Hindi: 13/40 outputs write English loanwords in Latin script ("call", "satellite"). Excluding those and
  number-format clips, Hindi median CER is 0.0% (n=25).
- Cantonese: raw median CER 19.1% is the Traditional/Simplified mismatch; Simplified-both median is 0.0%.
  Real errors remain in some clips (e.g. `yue_hant_hk_1560` 洋流 -> 弱流).
