# Forty-clip offline audit

Audit date: 2026-11-08 UTC. Reviewer: Codex, automated inspection only.
Manifest: `22373a9a40beaebc2eddcb3c4a8814b7ab3e8c194ff2388643e811546e1fb6f0`.
Audio/source: Speech Accent Archive, Weinberger (2015), George Mason University, https://accent.gmu.edu, supplied datathon pack; CC BY-NC-SA 4.0.

## Result and limits

All 40 selected recordings passed file/hash, metadata, reference-source, stream/duration, and full decode checks. The pending result bundle also passed its existing validation. All pilot files remained byte-identical after the audit. Total audio: 1162.857331 seconds, approximately 19 minutes 23 seconds. No API calls were made.

**Listening/reference approval is incomplete for all 40 recordings.** This runtime has no audio listening/perception tool. No transcript was generated, no words were inferred from the signal, and no sample was accepted, excluded, replaced, or corrected. `review_queue.csv` and frozen manifest review statuses remain pending. Automated signal checks do not establish intelligibility, speaker identity, freedom from distortion, or spoken word agreement with the reference.

## Reference inspection

Each manifest `reference_raw` exactly matches the supplied `elicitation_paragraph.txt` (69 words under `en_v1`). Every sample's saved metadata matches its source CSV row. IDs and encoded audio hashes are unique within the pilot. The baseline metadata records Canadian birth country, and all spoken-language fields are `en`.

The source reference is an elicitation prompt, not an independently verified per-recording verbatim transcript. Listen for omissions, repetitions, restarts, substitutions, added words, truncated beginnings/endings, and other speech. Pronunciation/accent differences alone do not justify replacing a sample. Do not use future Scribe predictions as ground truth or insert this paragraph as provider keyterms.

## Per-clip inspection

Every row below passed technical checks and still needs listening review. Peak and RMS are computed from decoded native-rate mono floating-point PCM, without resampling, gain changes, filtering, or saving derivative audio. Values are dBFS; they describe signal level, not recognition quality.

The advisory thresholds used for this audit were RMS below -35 dBFS, more than 0.1% of PCM values with absolute magnitude at least 0.999, an entirely zero signal, or a detected silence interval longer than 3 seconds. Silence detection used ffmpeg `silencedetect=noise=-40dB:d=1`. No clip crossed those thresholds. These heuristic screens are not exclusion criteria. No clip had a decoded sample at or above the near-fullscale threshold; encoded recordings may still contain earlier clipping or distortion.

| Sample ID | Seconds | Peak dBFS | RMS dBFS | Longest detected silence (s) |
|---|---:|---:|---:|---:|
| saa:english247 | 20.143 | -3.56 | -26.76 | 0.000 |
| saa:english29 | 32.556 | -3.43 | -24.57 | 0.000 |
| saa:english238 | 18.599 | -3.48 | -20.66 | 0.000 |
| saa:english439 | 22.482 | -3.43 | -26.14 | 0.000 |
| saa:english61 | 19.124 | -3.33 | -23.44 | 0.000 |
| saa:english105 | 23.094 | -0.66 | -14.37 | 0.000 |
| saa:english43 | 21.314 | -3.23 | -26.31 | 0.000 |
| saa:english64 | 24.012 | -2.02 | -19.12 | 0.000 |
| saa:english358 | 22.430 | -2.33 | -19.64 | 0.000 |
| saa:english159 | 22.075 | -3.36 | -26.88 | 0.000 |
| saa:urdu7 | 27.723 | -3.51 | -27.36 | 0.000 |
| saa:urdu1 | 48.376 | -1.88 | -17.66 | 0.000 |
| saa:urdu21 | 26.667 | -3.45 | -21.08 | 0.000 |
| saa:urdu17 | 24.200 | -3.61 | -24.50 | 0.000 |
| saa:urdu28 | 39.344 | -3.01 | -21.77 | 1.183 |
| saa:urdu2 | 32.060 | -2.75 | -28.03 | 0.000 |
| saa:urdu19 | 31.089 | -3.52 | -26.97 | 1.198 |
| saa:urdu24 | 23.841 | -3.57 | -23.72 | 0.000 |
| saa:urdu14 | 27.167 | -6.44 | -31.79 | 0.000 |
| saa:urdu6 | 24.754 | -3.46 | -23.96 | 0.000 |
| saa:arabic43 | 31.254 | -3.45 | -23.58 | 0.000 |
| saa:arabic184 | 28.727 | -3.00 | -23.98 | 1.201 |
| saa:arabic92 | 44.315 | -3.44 | -25.05 | 1.229 |
| saa:arabic192 | 27.029 | -3.00 | -21.30 | 1.126 |
| saa:arabic45 | 41.146 | -3.07 | -16.73 | 0.000 |
| saa:arabic32 | 27.718 | -3.56 | -25.01 | 1.213 |
| saa:arabic137 | 56.216 | -3.41 | -22.37 | 1.203 |
| saa:arabic112 | 19.648 | -3.45 | -21.40 | 0.000 |
| saa:arabic128 | 35.853 | -3.11 | -25.89 | 1.242 |
| saa:arabic103 | 23.847 | -3.42 | -21.52 | 0.000 |
| saa:mandarin54 | 22.303 | -3.22 | -22.74 | 0.000 |
| saa:mandarin18 | 32.720 | -2.47 | -21.35 | 0.000 |
| saa:mandarin93 | 29.874 | -3.47 | -23.59 | 0.000 |
| saa:mandarin30 | 38.069 | -3.22 | -32.06 | 0.000 |
| saa:mandarin57 | 23.376 | -3.44 | -24.18 | 0.000 |
| saa:mandarin53 | 30.123 | -3.03 | -22.60 | 0.000 |
| saa:mandarin147 | 32.943 | -3.00 | -23.84 | 0.000 |
| saa:mandarin108 | 28.584 | -2.88 | -21.55 | 0.000 |
| saa:mandarin131 | 24.897 | -3.00 | -23.02 | 0.000 |
| saa:mandarin101 | 33.164 | -3.81 | -24.21 | 0.000 |

A zero in the silence column means no interval was reported by this specific detector configuration; it does not mean the clip contains no pauses or background noise.

## Listening handoff and next gate

1. Open `data/derived/offline-pilot.json`. Resolve each `review_queue.csv` source-relative path beneath its `dataset_root`. Compare the whole recording with `reference_raw` in the manifest.
2. Record reviewer, UTC time, findings, status, and meaning-review status in the existing review queue. For doubtful or mismatched speech, keep the item pending and document the exact timestamp and words. Record proposed corrections in the override fields; do not edit the manifest. A reference correction or approved exclusion needs a new manifest version before scoring or paid work.
3. Murtada signs off all 40 records. Review import/versioning still needs implementation; editing the CSV alone does not approve the frozen manifest.
4. Implement/configure the benchmark ElevenLabs adapter with secure credentials and a bounded budget. It is separate from Hisham's app interaction work. Existing metric functions are ready, but live transcription, review import, score/import, and measured export commands remain unfinished.
5. Perform a separately authorized two-clip smoke test, inspect raw outputs and scoring, then ask Murtada to authorize the remaining full pilot. Reuse cached smoke outputs if settings and audio are unchanged; do not pay to retranscribe them unnecessarily.

The user's instruction authorizes review and requires asking before the full 40-clip run. It does not yet authorize a paid run. Retain raw provider output for later scoring without another API call.
