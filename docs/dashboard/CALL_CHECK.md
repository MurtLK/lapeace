# Call Check source and website integration

Call Check is a separate demo from the accented-English benchmark. It records a browser microphone sample, not an actual telephone call. Its request verdict comes from English keyword rules, not accent or synthetic-voice classification.

## Canonical source

| File | Responsibility |
| --- | --- |
| `backend/public/call-check.html` | Microphone recording, WAV encoding, demo audio buttons and results display. It now includes a method explanation and repository links. |
| `backend/src/callcheck.js` | `POST /api/callcheck`, WAV validation, Scribe v2 transcription and the optional voice process. |
| `backend/src/scamrules.js` | Phrase lists, weights and verdict thresholds. No trained scam classifier. |
| `backend/scripts/voice_detector.py` | Optional acoustic-feature logistic regression prototype. Training uses real recordings and built-in macOS voices, not modern neural clones. |
| `backend/data/voice_model.json` | Saved optional voice-model parameters and evaluation metadata. |
| `web/public/dashboard-app/connect.js` | Opens Call Check within the dashboard and forwards the configured public backend address. |

The request score is the sum of weights for matched flag categories. Score 0 returns no_red_flags, scores 1 and 2 return be_careful, and score 3 or more returns likely_scam. The labels are not calibrated probabilities or identity verification. A transcription error or missed keyword can change the result. A harmless mention can also match a keyword. These English phrase rules do not cover all languages. The optional voice score does not affect this verdict.

## One interface, available on the website

`scripts/prepare-dashboard.mjs` copies the canonical browser interface into `web/public/dashboard-app/call-check.html` before Vite development and production builds. The generated copy is gitignored. `.vercelignore` includes the canonical public HTML while excluding backend data, executable server source and local secrets from the frontend upload.

The full-page dashboard embeds that local Call Check page and resizes it to its actual height, rather than framing a backend-only page that disappears on a static host. The page accepts a validated HTTP(S) `backend` query value for API calls. Live transcription still requires the separately configured backend and ElevenLabs credentials; no key is shipped to the browser. The explanation and source links stay readable when those APIs are unavailable.

The interface tells users when audio is sent to ElevenLabs. The optional local voice process writes a temporary WAV and deletes it after processing. The app has no recording-history feature. We do not infer provider retention from the application code.

## Dashboard guide

The homepage explains all seven dashboard sections at `/#dashboard-guide`. Each guide link opens its corresponding tab. The dashboard also has a return link to that guide. Call Check has its own homepage explanation at `/#call-check`, with implementation links in a disclosure.

## Verification

All 23 tests, typecheck and production build passed. Chrome verification covered all seven direct tab links, the guide return anchor, the bundled Call Check page, its four implementation links, static-host/API-unavailable behavior, 200% homepage text size and responsive captures. The production Call Check asset matched the canonical file byte for byte. Verification made only GET requests, with no microphone recording, live transcription or provider session.

## Readiness and palette

Call Check uses the same light paper, forest text, white surfaces and green controls as the dashboard. Its longer explanations and sample scripts are expandable. GET `/api/callcheck/status` exposes only configuration booleans and enables the microphone UI when configured. The local key is private; a hosted backend requires its own environment configuration. Configuration presence is not a successful paid transcription test.
