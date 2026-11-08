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
| `CORS_ORIGIN` | Optional. Lock to the UI's origin (e.g. `http://localhost:5173`) instead of `*`. |

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
3. `curl -s -X POST localhost:8787/api/agent/session` should return a `conversation_token`. Don't share it; it expires in minutes anyway.
4. Open **http://localhost:8787/dev/agent-test** in Chrome, click **Start conversation**, allow the mic and say *"Someone stole my card, I need to freeze it."* The agent should ask a clarifying question, read the request back for confirmation, and say it's a simulated freeze. The transcript appears on the page.

The test page loads `@elevenlabs/client@1.28.0` from jsDelivr and is served by the backend itself, so it works before the UI exists.

## Not built yet

`/api/wards` (census).
