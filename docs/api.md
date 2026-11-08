# LAPEACE backend API

The backend is a small Node 24 server (built-in `node:http`, no dependencies) in `backend/`. It serves the Speech Accent Archive clips with their ElevenLabs Scribe transcripts and error rates, and it streams the audio.

## Run it

```bash
cd backend
cp .env.example .env      # first time only, then edit the paths (see below)
npm start                 # http://localhost:8787
```

- `npm run dev` does the same but restarts when you edit files.
- `npm run start:fixture` ignores `.env` and serves one bundled clip with a **simulated** transcript, for UI work without the dataset.
- Use `PORT=8788 npm start` if 8787 is taken.
- On this Mac, Homebrew's node is broken, so prefix commands with `PATH=/usr/local/bin:$PATH`.

At startup the server prints how many samples it loaded, where from, and its PID. If the data configuration is wrong, it refuses to start and says why:
- only one of `SAMPLES_FILE` / `AUDIO_DIR` is set
- a folder or file is missing
- the JSON is invalid
- audio files listed in the JSON aren't in `AUDIO_DIR`

When it serves the fixture, it prints a `WARNING: serving FIXTURE data` line.

## Data configuration (`backend/.env`, gitignored, one per machine)

| Variable | Meaning |
|---|---|
| `SAMPLES_FILE` | JSON with the sample records. The real one is `data/samples.saa.json` (in the repo). |
| `AUDIO_DIR` | **Absolute path on your machine** to the dataset's `03_accented_english_SpeechAccentArchive/audio` folder |
| `SAA_TRANSCRIPTS`, `SAA_DATASET` | Only for regenerating the JSON (below) |
| `PORT` | Optional, default `8787` |

Set **both** `SAMPLES_FILE` and `AUDIO_DIR` for real data, or **neither** for the fixture. Relative paths are resolved from `backend/`.

### Regenerating `data/samples.saa.json`

Only needed when the Scribe results change:

```bash
npm run import:saa
```

This reads `SAA_TRANSCRIPTS` (the pipeline's `transcripts.csv`) and `SAA_DATASET` (the folder holding `metadata.csv` and `audio/`). It matches every `clip_id` to `metadata.csv`'s `file` column, checks each audio file exists, and reports:
- rows with no metadata
- missing audio
- group mismatches
- audio files with no transcript

It exits non-zero if any row has no audio.

## What each teammate needs to play the clips

1. This repo, with `backend/data/samples.saa.json` (committed, contains no machine paths).
2. The dataset unzipped locally: `Datasets.zip`, then `Mississauga_Unheard_ElevenLabs_Track.zip`. The audio is in `.../03_accented_english_SpeechAccentArchive/audio/` (468 MP3s). **The audio is not in Git.**
3. `backend/.env` with `SAMPLES_FILE=data/samples.saa.json` and `AUDIO_DIR=` pointing at that folder on *their* machine.
4. `npm start`, then the UI calls `http://localhost:8787`.

If you only build UI and don't have the dataset, use `npm run start:fixture`. It's one clip with the same response shape.

## Endpoints

### `GET /api/samples`

Returns every sample (468 with real data). Cross-origin requests are allowed from any origin.

| Field | Type | Meaning |
|---|---|---|
| `source` | string | `speech_accent_archive_scribe` for real data, `fixture` for the test clip |
| `notice` | string | Human-readable description of the data |
| `samples[].clip_id` | string | Clip ID, e.g. `urdu1` (= audio file name without `.mp3`) |
| `samples[].dataset` | string | `speech_accent_archive` |
| `samples[].duration_sec` | number | Clip length in seconds (from dataset metadata) |
| `samples[].reference_transcript` | string | The paragraph the speaker was asked to read (identical for all clips) |
| `samples[].scribe_transcript` | string | **Raw** ElevenLabs Scribe output (`scribe_v2`, language `en`, no audio-event tags, no keyterms). Punctuation and fillers like "uh" are kept. |
| `samples[].scribe_transcript_is_simulated` | boolean | `false` for real data. **If `true`, show a "simulated" badge.** |
| `samples[].wer` | number or null | **Word error rate as a fraction, 0 to 1** (0.087 = 8.7% of reference words wrong). It's (substitutions + deletions + insertions) ÷ reference words, after lowercasing and removing punctuation from both texts. It can exceed 1 in theory. `null` in the fixture. Spoken fillers count as insertions. |
| `samples[].speaker_group` | string | Speaker's first-language group: one of 15, e.g. `Urdu`, `Arabic`, `English` (Canadian-born baseline) |
| `samples[].speaker.first_language` | string or null | First language as written in the dataset (lowercase) |
| `samples[].speaker.gender` | string or null | `male` / `female` as recorded in the dataset |
| `samples[].speaker.age` | number or null | Age at recording |
| `samples[].speaker.birth_country` | string or null | Lowercase country name |
| `samples[].speaker.english_onset_age` | number or null | Age the speaker started learning English |
| `samples[].audio_url` | string | Absolute URL of the MP3 |

Group sizes: English 45, Arabic 40, Mandarin Chinese 40, Portuguese 40, Spanish 40, Vietnamese 39, Polish 38, Cantonese 35, Hindi 34, Tagalog 29, Urdu 29, Bengali 21, Gujarati 17, Punjabi 11, Tamil 10. **Small groups (Punjabi, Tamil) give noisy averages.**

Real example (one of the 468 records):

```json
{
  "source": "speech_accent_archive_scribe",
  "notice": "Real ElevenLabs Scribe (scribe_v2) transcripts of Speech Accent Archive recordings. wer is a fraction (0.05 = 5%).",
  "samples": [
    {
      "clip_id": "urdu1",
      "dataset": "speech_accent_archive",
      "duration_sec": 48.43,
      "reference_transcript": "Please call Stella.  Ask her to bring these things with her from the store:  Six spoons of fresh snow peas, five thick slabs of blue cheese, and maybe a snack for her brother Bob.  We also need a small plastic snake and a big toy frog for the kids.  She can scoop these things into three red bags, and we will go meet her Wednesday at the train station.",
      "scribe_transcript": "Please call Stila. Ask her about to bring these things with her from the store. Six spoons of fresh snow peas, five thick slabs of blue cheese, and maybe a snacks of her brother Bob. We also need a small plastic snack and a big toy frog for the kids. She can s-scoop these things into three red bags, and we will go meet her Wednesday at the train station.",
      "scribe_transcript_is_simulated": false,
      "wer": 0.087,
      "speaker_group": "Urdu",
      "speaker": {
        "first_language": "urdu",
        "gender": "male",
        "age": 22,
        "birth_country": "pakistan",
        "english_onset_age": 18
      },
      "audio_url": "http://localhost:8787/audio/urdu1.mp3"
    }
  ]
}
```

### `GET /audio/{file}`

Streams an MP3 from `AUDIO_DIR` as `audio/mpeg`. It supports `Range` requests (206), so `<audio>` seeking works.

| Response | When |
|---|---|
| 400 | Invalid file name |
| 404 | Missing file |

Use the `audio_url` from `/api/samples` rather than building URLs yourself.

### `GET /api/groups`

Per-speaker-group summary, computed at request time from the **same records** `/api/samples` serves. These numbers were cross-checked against the pipeline's `summary_by_group.csv` and `transcripts.csv`: all 15 groups match on clip count, mean, median and above-threshold count.

**WER unit:** everywhere in this API, WER is a **fraction** (0.05 = 5%), never a percentage. Multiply by 100 for display.

| Field | Meaning |
|---|---|
| `wer_unit` | Always `"fraction (0.05 = 5% of reference words wrong)"` |
| `high_wer_threshold` | `0.05` |
| `definitions` | The text definitions below, so the UI can show them in tooltips |
| `groups[].speaker_group` | Group name |
| `groups[].clips` | Number of clips in the group (the denominator for the share) |
| `groups[].mean_wer` | Mean of per-clip WER |
| `groups[].median_wer` | Median of per-clip WER. **Prefer this for headlines**, because a few very hesitant speakers skew the mean (e.g. Arabic: mean 0.0725 vs. median 0.029). |
| `groups[].clips_above_threshold` | Clips with WER **strictly greater than 0.05** |
| `groups[].share_above_threshold` | `clips_above_threshold / clips`. The denominator is **all clips in that group**. |
| `groups[].filler_sensitivity` | **Sensitivity analysis only, not the primary metric.** The same four statistics after removing spoken fillers (`uh, um, er, ah, eh, hmm, mm, uhm, erm`) from the Scribe transcript. Label it as such if you show it. |

`groups` is sorted by `mean_wer`, highest first. With fixture data, `groups` is empty (the fixture has `wer: null`).

Real response (first of 15 groups shown):

```json
{
  "source": "speech_accent_archive_scribe",
  "wer_unit": "fraction (0.05 = 5% of reference words wrong)",
  "high_wer_threshold": 0.05,
  "definitions": { "mean_wer": "...", "median_wer": "...", "clips_above_threshold": "...", "share_above_threshold": "...", "filler_sensitivity": "..." },
  "groups": [
    {
      "speaker_group": "Arabic",
      "clips": 40,
      "mean_wer": 0.0725,
      "median_wer": 0.029,
      "clips_above_threshold": 13,
      "share_above_threshold": 0.325,
      "filler_sensitivity": {
        "mean_wer": 0.0504,
        "median_wer": 0.0145,
        "clips_above_threshold": 11,
        "share_above_threshold": 0.275
      }
    }
  ]
}
```

### `POST /api/agent/session`

Returns a **short-lived credential** for the private ElevenLabs freeze-card demo agent. The API key and agent ID stay on the server; the response contains only what the browser SDK needs.

| Server env var (`backend/.env`) | Meaning |
|---|---|
| `ELEVENLABS_API_KEY` | Secret. Server only. |
| `ELEVENLABS_AGENT_ID` | The demo agent's ID (`agent_...`) |
| `AGENT_CONNECTION` | `webrtc` (default) or `websocket`. **Agree this with the UI team**: it decides which field the response contains. |
| `CORS_ORIGIN` | **Required for the UI.** Comma-separated origins allowed to create sessions, e.g. `http://localhost:5173`. The backend's own pages (`http://localhost:8787`) are always allowed. Any other origin, and requests with no `Origin` header (e.g. curl), get `403 origin_not_allowed`. Read-only routes stay open to all origins. |
| `PUBLIC_BASE_URL` | Optional, default `http://localhost:<PORT>`. Base used for `audio_url`. It is never taken from the request's Host header. |

**Responses:**

| Status | Body | Meaning |
|---|---|---|
| 200 | `{ "connection_type": "webrtc", "conversation_token": "..." }` | Default. The token is valid for about 10 minutes, so request it right before starting. |
| 200 | `{ "connection_type": "websocket", "signed_url": "wss://..." }` | When `AGENT_CONNECTION=websocket`. The URL is valid for 15 minutes. |
| 503 | `{ "error": "agent_not_configured", "missing": [...] }` | Key or agent ID not set on the server |
| 429 | `{ "error": "too_many_sessions", "retry_after_sec": 60 }` | More than 10 sessions per minute from one IP (protects the team's credits) |
| 502 | `{ "error": "agent_session_failed", "upstream_status": 401 }` | ElevenLabs refused. 401 usually means a bad key, 404 a wrong agent ID. |
| 405 | `{ "error": "use POST" }` | Must be POST, so link previews and prefetching can't create sessions |

Responses are `Cache-Control: no-store`. Request a new credential for **every** conversation; don't reuse one.

Under the hood, the server calls ElevenLabs:
- WebRTC: `GET /v1/convai/conversation/token?agent_id=…`
- WebSocket: `GET /v1/convai/conversation/get-signed-url?agent_id=…`

Both send the `xi-api-key` header. ElevenLabs' `conversation_id` is dropped before responding.

#### Frontend handoff

**Connection method: WebRTC (`conversationToken`).** It's the ElevenLabs SDK's default for voice conversations. If the UI team prefers WebSocket, set `AGENT_CONNECTION=websocket` and use `signedUrl` instead. Nothing else changes.

React (`npm install @elevenlabs/react`, pin the version in `package.json`):

```jsx
import { useConversation } from '@elevenlabs/react';

const conversation = useConversation({
  onMessage: ({ source, message }) => console.log(source, message),
  onError: (e) => console.error(e),
});

async function start() {
  // Explain why first: the agent needs the mic.
  await navigator.mediaDevices.getUserMedia({ audio: true });
  const res = await fetch('http://localhost:8787/api/agent/session', { method: 'POST' });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error);
  await conversation.startSession(
    body.connection_type === 'webrtc'
      ? { conversationToken: body.conversation_token }
      : { signedUrl: body.signed_url },
  );
}
// end: conversation.endSession()
```

Plain JS uses the same pattern with `import { Conversation } from '@elevenlabs/client'` and `Conversation.startSession({...})`.

**UI must show:** a "Simulated demo: no real bank or card is involved" notice, and a request not to say real card numbers or personal details.

#### Testing one conversation

1. Add `ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID` to `backend/.env`, then `npm start`. The startup log should say `Agent: ready (webrtc)`.
2. `npm run agent:check`. This is read-only: it prints the agent's name, language, first message, the start of its prompt and its tools. Confirm it's the freeze-card prompt in `docs/agent-demo.md` and that **Tools: none**.
3. `curl -s -X POST -H 'Origin: http://localhost:8787' localhost:8787/api/agent/session` should return a `conversation_token`. Without the `Origin` header you get 403, by design. Don't share it; it expires in minutes anyway.
4. Open **http://localhost:8787/dev/agent-test** in Chrome, click **Start conversation**, allow the mic and say *"Someone stole my card, I need to freeze it."* The agent should ask a clarifying question, read the request back for confirmation, and say it's a simulated freeze. The transcript appears on the page.

The test page loads `@elevenlabs/client@1.28.0` from jsDelivr and is served by the backend itself, so it works before the UI exists.

### `GET /api/samples` options

- `featured_clip_id` (top level): the default clip for "Hear a real example". It's `FEATURED_CLIP_ID` from `.env` if valid, otherwise the highest-WER Mandarin/Punjabi clip.
- `?clip_id=urdu1` returns just that clip.
- `?diff=1` adds `scribe_ops` to each sample: the word diff against the reference, in the same op format as below.

### `GET /api/comparison`: A/B Transcript Replay

This compares **ElevenLabs Scribe v2** (baseline, the existing results) with **Whisper large-v3-turbo**, run locally with whisper.cpp 1.9.5 (q5_0 model, language `en`, beam 5, no prompt).
- **Clips:** 95 Speech Accent Archive clips. That's every Mandarin-background (40), Punjabi-background (11) and Canadian English (44) clip, with `english132` excluded as a possible duplicate speaker. The set was locked before any Whisper output existed.
- **Same inputs:** both systems use the same audio and the same reference.
- **Live agent:** the live agent does **not** use Whisper (ElevenLabs Agents has no option for an outside recognizer).
- **No configured file:** if `COMPARISON_FILE` isn't set, the endpoint returns `404 {"error":"comparison_not_available"}`.

**Query options:**
- `?ops=0` drops the word diffs: about 190 KB instead of 1.6 MB, good for list and chart views.
- `?clip_id=mandarin87` returns one clip with its diffs.

**Two scorings, side by side:**
- `raw` is the published benchmark rule.
- `normalized` applies the same rule to both systems and the reference, and additionally removes fillers, expands "we'll", collapses stutters and converts digits 0–10 to words.

**Top-level fields:**

| Field | Meaning |
|---|---|
| `systems.baseline`, `systems.alternative` | `id`, `label`, where it runs, exact settings |
| `featured.better`, `featured.worse` | Clip IDs for the default A/B views. Hand-picked, with the reason in `featured_notes`. |
| `overall`, `groups[]` | `clips`, `clips_with_dropped_passage.{baseline,alternative}`, and for each of `raw` and `normalized`: baseline/alternative `mean_wer` and `median_wer`, `mean_diff_pp`, `median_diff_pp`, and `improved`/`worse`/`same` counts |
| `clips[]` | One entry per clip; fields below. Sorted by `delta_wer.normalized`, Whisper's biggest wins first. |

**Fields in each `clips[]` entry:**

| Field | Meaning |
|---|---|
| `clip_id`, `speaker_group`, `audio_url`, `duration_sec`, `reference_transcript` | Clip details, in the same format as `/api/samples` |
| `baseline.transcript`, `alternative.transcript` | Raw text from each system |
| `baseline.raw`, `baseline.normalized` (and the same for `alternative`) | `{wer, errors}` under each scoring |
| `baseline.longest_dropped_run`, `baseline.dropped_passage` (and the same for `alternative`) | Longest run of consecutive reference words that system skipped; `dropped_passage` is true at 5 or more |
| `baseline.ops`, `alternative.ops` | `[{op, ref, hyp}]`, where `op` is `equal`, `sub` (substituted), `del` (reference word missed) or `ins` (extra word). Tokens are normalized, so show the raw transcript separately. |
| `delta_wer.{raw,normalized}` | Alternative minus baseline WER, as a fraction |
| `outcome.{raw,normalized}` | `improved`, `worse` or `same`, by comparing the integer error counts |
| `alternative_transcript_is_simulated` | `false` for real results |

**Units:** WER is a fraction, as everywhere in this API. `*_diff_pp` values are **percentage points**, alternative minus baseline, so **negative means Whisper was better**.

**Measured result (normalized scoring):**

| Group | Clips | Scribe mean | Whisper mean | Diff (pp) | Whisper better / worse / same | Clips with a dropped passage (Scribe / Whisper) |
|---|---|---|---|---|---|---|
| Mandarin-background | 40 | 5.04% | 9.09% | +4.06 | 7 / 26 / 7 | 0 / 9 |
| Punjabi-background | 11 | 4.88% | 5.40% | +0.53 | 3 / 4 / 4 | 0 / 1 |
| Canadian English | 44 | 0.20% | 0.72% | +0.53 | 1 / 3 / 40 | 0 / 1 |

**Overall, Scribe did better on this set.** Most of Whisper's deficit comes from **11 clips where it silently skipped a whole phrase or sentence**; Scribe never did. Leave those clips out and the two are close (Mandarin +0.70 pp, Punjabi −0.58 pp, English +0.03 pp). The Punjabi group has 11 speakers, so its result is noisy. These are descriptive results, with no significance test.

**Regenerating:** `npm run import:comparison -- --transcripts <whisper_transcripts.csv> --settings <whisper_settings.json>`. This keeps the hand-picked featured clips. The Whisper runner and cache are in `pipeline/whisper_saa/` and `results/ab_whisper/` on branch `hisham/scribe-saa`.

### Evidence endpoints (precomputed JSON in `backend/data/`, read-only)

| Endpoint | File | Built by | Contents |
|---|---|---|---|
| `GET /api/census` | `census.json` | `npm run build:census` | 2021 Census, **residents who speak the language most often at home**, for Mandarin and Punjabi: citywide total (cross-checked 5 ways), all 11 wards (corrected table), top 5 neighbourhoods. Not combined with WER. |
| `GET /api/audit` | `audit.json` | `npm run build:audit` | Benchmark audit: median WER by background × recorded gender with small/unbalanced flags, audio measurements (no microphone metadata exists), heuristic categories, listening-review clip IDs |
| `GET /api/clarify311` | `clarify311.json` | `npm run test:311` | 6 scripted 311 requests: synthetic voice, real Scribe v2 transcript, rule-based first interpretation, scripted correction, final confirmed intent, summary counts |
| `GET /audio311/{file}` | `CLARIFY_AUDIO_DIR` | `npm run make:311-audio` | The 311 caller audio (generated locally, not in Git). 404 when not configured. |

A missing file returns `404 {"error":"not_available"}`.

## Not built yet

`/api/wards` (census).
