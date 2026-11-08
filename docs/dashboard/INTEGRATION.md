# Dashboard integration

The homepage's Open dashboard links open `/dashboard`. React hosts the existing Mississauga Unheard app in a titled iframe, with Back to website navigation and a standalone workspace link. This preserves the teammate's complete scoring, filtering, notes, exports and CSS rather than replacing it with the earlier React prototype.

## Sources

- `web/public/dashboard-app/`: copied from `origin/hisham/wire-site` at `35e35af`. `app.js`, `style.css`, index and both CSVs are unchanged. `connect.js` uses a same-origin backend by default instead of an expired Cloudflare tunnel and validates configured HTTP(S) addresses.
- `backend/`: copied from `origin/hisham/backend` at `8ab2a15`. The server and committed evidence are unchanged.
- `ResearchDashboard.tsx` and `research-dashboard.css`: React route and isolated workspace wrapper. Optional `?tab=community` opens the census tab. `?tab=languages` and `?tab=callcheck` open the teammate's corresponding tabs.

## Run locally

Use Node 24 or newer. Run `npm --prefix web ci`, then `npm run dev` from the root. This starts the backend and Vite. `npm run dev:frontend` and `npm run dev:backend` run them separately when needed.

With no `backend/.env`, the backend uses its one-clip fixture for audio/API data. The dashboard's bundled CSV analysis still contains 468 recordings. For all real audio, copy `backend/.env.example` to `backend/.env`, set SAMPLES_FILE to `data/samples.saa.json`, and point AUDIO_DIR to the extracted Speech Accent Archive audio folder. Configure COMPARISON_FILE as documented in the example. Do not commit local paths or credentials.

Vite proxies `/api`, `/audio`, `/audio311` and `/call-check` to port 8787. For hosted frontend builds, set VITE_API_BASE_URL to the public backend HTTP(S) address before building, or configure equivalent same-origin reverse proxies. `?backend=https://...` on `/dashboard` is a session-only override. SPA hosting must rewrite `/dashboard` to the React index while serving `/dashboard-app/*` as static files. A GitHub source push alone does not deploy a backend.

The private local backend configuration on this machine uses the existing dataset for all 468 audio files. No source audio was copied into the frontend. Live Call Check and agent sessions require separately configured ElevenLabs credentials. Integration verification made only GET requests and started no live sessions or provider calls.

## Verification

Typecheck, build and all 15 tests pass. Real browser checks verified homepage-to-dashboard navigation, 468 recordings, search for mandarin87, native clip playback with a 206 range response, both census language panels, switching back to the original dashboard tabs, direct community refresh and return navigation. Desktop and 390px mobile renders had no page errors or horizontal page overflow. No request used the prior temporary Cloudflare host. The shared header adapts to mobile; the teammate's navigation scrolls horizontally inside its own page.
