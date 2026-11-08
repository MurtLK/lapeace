# Dashboard integration

The homepage's Open dashboard links open `/dashboard`. React opens the existing LAPEACE app as a standalone full-page workspace with Back to website and Dashboard guide navigation. This preserves the teammate's complete scoring, filtering, notes, exports and CSS rather than replacing it with the earlier React prototype.

## Sources

- `web/public/dashboard-app/`: copied from `origin/hisham/wire-site` at `35e35af`. The CSVs and scoring logic are unchanged. Visible branding, document title, logo and export filenames now use LAPEACE. Legacy storage keys remain so existing notes and flags survive the rename. `connect.js` uses a same-origin backend by default instead of an expired Cloudflare tunnel and validates configured HTTP(S) addresses.
- `backend/`: copied from `origin/hisham/backend` at `8ab2a15`. The server and committed evidence are unchanged.
- `ResearchDashboard.tsx` and `research-dashboard.css`: launch route for the native workspace. Optional `?tab=community` opens the census tab. `?tab=languages` and `?tab=callcheck` open the teammate's corresponding tabs.

## Run locally

Use Node 24 or newer. Run `npm --prefix web ci`, then `npm run dev` from the root. This starts the backend and Vite. `npm run dev:frontend` and `npm run dev:backend` run them separately when needed.

With no `backend/.env`, the backend uses its one-clip fixture for audio/API data. The dashboard's bundled CSV analysis still contains 468 recordings. For all real audio, copy `backend/.env.example` to `backend/.env`, set SAMPLES_FILE to `data/samples.saa.json`, and point AUDIO_DIR to the extracted Speech Accent Archive audio folder. Configure COMPARISON_FILE as documented in the example. Do not commit local paths or credentials.

Vite proxies `/api`, `/audio`, `/audio311` and `/call-check` to port 8787. For hosted frontend builds, set VITE_API_BASE_URL to the public backend HTTP(S) address before building, or configure equivalent same-origin reverse proxies. `?backend=https://...` on `/dashboard` is a session-only override. SPA hosting must rewrite `/dashboard` to the React index while serving `/dashboard-app/*` as static files. A GitHub source push alone does not deploy a backend.

All 468 complete source recordings now have compressed, attributed web previews in the frontend. The private backend keeps its original audio path for backend use. Live Call Check and agent sessions require separately configured ElevenLabs credentials. Integration verification made only GET requests and started no live sessions or provider calls.

## Verification

Typecheck, build and all 15 tests pass. Real browser checks verified homepage-to-dashboard navigation, 468 recordings, search for mandarin87, native clip playback with a 206 range response, both census language panels, switching back to the original dashboard tabs, direct community refresh and return navigation. Desktop and 390px mobile renders had no page errors or horizontal page overflow. No request used the prior temporary Cloudflare host. The shared header adapts to mobile; the teammate's navigation scrolls horizontally inside its own page.

## Call Check and dashboard explanations

The homepage now explains all seven tabs, with working deep links and a return-to-guide link in the dashboard. Call Check includes the actual canonical browser interface in the static build, an explanation of its fixed request rules and optional voice prototype, and repository source links. See [Call Check source](CALL_CHECK.md) for the canonical files, build copy and verification. The newest verification passed all 23 tests; earlier counts above describe the initial integration.

## Full-page layout, previews and key configuration

The dashboard now opens without the outer iframe. Its project header is compact, clips are paginated 25 at a time, and individual variation is available in an expandable section. Call Check uses the dashboard's light/green palette and automatically fits its content height.

Each transcript preview includes native audio controls, CC BY-NC-SA attribution and a link to the imported audio manifest. All 468 source/preview hashes are recorded. The web previews are complete recordings re-encoded for delivery; benchmark scores still refer to the originals. Closing the review dialog pauses its audio.

The local ElevenLabs key is configured in gitignored `backend/.env`, never in the browser bundle. Configuration status is available through the non-secret GET `/api/callcheck/status`. Live-call POST and preflight requests still require an allowed origin. No paid transcription test was performed.

All 23 tests, typecheck and build passed. Chrome checks verified native navigation, pagination, static audio range/decoding, source attribution, matching backgrounds, responsive frame fitting, readiness and CORS preflight. The same preview audio loads with the backend unavailable.
