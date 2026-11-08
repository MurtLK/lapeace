# Lovable handoff: A/B Transcript Replay

Paste this into Lovable. `API_BASE` is the backend URL; today it's the Cloudflare tunnel, which **changes on every restart**, so keep it in one config value.

```
Add an "A/B Transcript Replay" panel inside Section 1 (Hear the Evidence), below the single-clip player.
Data: GET {API_BASE}/api/comparison?ops=0 for the list and summary;
      GET {API_BASE}/api/comparison?clip_id=<id> for the selected clip (it includes the word diffs).

What it compares: ElevenLabs Scribe v2 (systems.baseline) vs Whisper large-v3-turbo run locally
(systems.alternative) on 95 Speech Accent Archive recordings: Mandarin-background 40,
Punjabi-background 11, Canadian English 44. Same audio, same reference, same scoring.

Required label (always visible): "Measured on Speech Accent Archive recordings. The live agent
does not use Whisper." Show systems.*.label, with settings in a details popover.

Default view: two tabs, featured.better and featured.worse (hide a tab if it's null). Show
featured_notes.<tab> as the caption.
For the selected clip:
  - an audio player (audio_url, use as-is)
  - three rows: Reference / Scribe v2 / Whisper. Show the raw transcript text, then the word diff
    from baseline.ops and alternative.ops:
    equal = plain; sub = struck reference word + replacement with a "changed" icon;
    del = struck reference word with a "missed" icon; ins = extra word with an "added" icon.
    Don't rely on colour alone.
  - WER for each system: multiply the fraction by 100 once, one decimal place.
  - if alternative.dropped_passage (or baseline.dropped_passage) is true, show a warning badge:
    "Skipped N words in a row" (N = longest_dropped_run).

Summary table, by group: clips, Scribe mean WER, Whisper mean WER, difference in percentage points
(mean_diff_pp, already in pp; negative = Whisper better), better/worse/same counts, and
"clips with a skipped passage" (clips_with_dropped_passage.baseline / .alternative).
Use the `normalized` scoring by default, with a toggle to `raw`
("raw = published benchmark rule, counts uh/um and stutters").
Mark Punjabi "small sample (11 speakers)". Add this note: "Descriptive results; no significance test."

Headline text: "On these 95 recordings Scribe v2 had fewer errors than Whisper. Whisper silently
skipped a phrase or sentence in 11 recordings; Scribe skipped none."

Errors: 404 comparison_not_available -> hide the panel. source == "fixture" or
alternative_transcript_is_simulated -> show a "Sample data" badge.

Keep separate, each with its own label:
  (a) Phishing Red-Flag Check = rule-based, simulated, front-end only. It is not driven by either model.
  (b) Live freeze-card agent (POST /api/agent/session) = simulated demo. "No real bank or card
      is involved. Don't say real card numbers or personal details." Its origin must be listed in
      the backend's CORS_ORIGIN, or it gets 403.
```
