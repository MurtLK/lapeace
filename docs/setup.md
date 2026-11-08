# Running the LAPEACE judging demo

The demo is the backend's homepage, **http://localhost:8787/**, served by a small Node 24 server with no dependencies. All results (transcripts, comparisons, census, audit, 311 test) are committed as JSON in `backend/data/`. The only thing you need locally is the **dataset audio**, which isn't in Git.

## 1. Get the data (once)

1. Download `Datasets.zip` from the Sheridan Datathon 2026 hacker package (Discord or Devpost) and unzip it.
2. Inside it, unzip `ElevenLabs Track - Mississauga Unheard/Mississauga_Unheard_ElevenLabs_Track.zip`.
3. You need this folder: `.../Mississauga_Unheard_ElevenLabs_Track/03_accented_english_SpeechAccentArchive/audio/` (468 MP3s).

The Speech Accent Archive audio is licensed CC BY-NC-SA (non-commercial). It stays out of Git; only one 300 KB fixture clip is committed.

## 2. Configure (once)

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` (it's gitignored; your paths and keys stay local):

```
SAMPLES_FILE=data/samples.saa.json
AUDIO_DIR=/ABSOLUTE/PATH/TO/Mississauga_Unheard_ElevenLabs_Track/03_accented_english_SpeechAccentArchive/audio
COMPARISON_FILE=data/comparison.whisper.json
CLARIFY_AUDIO_DIR=data/local/311-audio
```

Optional, **macOS only**: generate the 311 test's caller audio. This uses the built-in `say` voices and makes no API calls.

```bash
npm run make:311-audio
```

On other systems, skip this step: the 311 section still shows every result, just without play buttons. The regenerated audio is a fresh synthesis of the same scripts and voices, not the exact files Scribe transcribed (those are on branch `hisham/scribe-saa` under `results/clarify_311/`).

## 3. Run

```bash
npm start            # prints samples loaded, comparison clips, agent status
open http://localhost:8787/
```

If Homebrew's node is broken on your Mac, use `PATH=/usr/local/bin:$PATH npm start`. If the port is taken, use `PORT=8788 npm start`.

**Checklist before judging:**
- [ ] "Hear the difference" plays `mandarin87` and shows the reference plus both transcripts
- [ ] "See the results" shows 3 rows (Mandarin 40, Punjabi 11, English 44)
- [ ] "Who and where" shows 17,730 (Mandarin) and 15,025 (Punjabi)
- [ ] "311 clarification test" shows 4 of 6 first, 6 of 6 final
- [ ] "Freeze-card replay" steps through to "Final confirmed request"

## Sharing a link (optional)

```bash
cloudflared tunnel --url http://localhost:8787        # prints https://<random>.trycloudflare.com
PUBLIC_BASE_URL=https://<random>.trycloudflare.com npm start   # so audio links use the public address
```

The address changes every time the tunnel restarts. It only works while this laptop is awake.

## Live agent (optional, needs keys)

Add `ELEVENLABS_API_KEY` (with Agents access) and `ELEVENLABS_AGENT_ID` to `backend/.env`, then open http://localhost:8787/dev/agent-test. See `docs/agent-demo.md`.

## Rebuilding the committed results (not needed for the demo)

| Output | Command | Needs |
|---|---|---|
| `data/samples.saa.json` | `npm run import:saa` | Scribe `transcripts.csv` (branch `hisham/scribe-saa`) + dataset |
| `data/comparison.whisper.json` | `npm run import:comparison -- --transcripts … --settings …` | `results/ab_whisper/` (branch `hisham/scribe-saa`) |
| `data/census.json` | `npm run build:census -- --census <01_people_census> --crosswalk <language_crosswalk.csv>` | dataset |
| `data/audit.json` | `npm run build:audit -- --samples data/samples.saa.json --transcripts <transcripts.csv> --audio-dir <audio> --wav-cache /tmp/wav` | Python 3 with numpy, macOS `afconvert` |
| `data/clarify311.json` | `ELEVENLABS_API_KEY=… npm run test:311 -- --work <dir>` | macOS `say`, and a Scribe key for uncached clips |
