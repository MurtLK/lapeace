# Deploy on Vercel

Import https://github.com/MurtLK/lapeace into Vercel. Use the repository root as Root Directory, not `web`. The committed `vercel.json` sets the install command, build command, output directory and `/dashboard` refresh rewrites. Node 24 is required.

The homepage, dashboard and its 468-transcript analysis work as a static deployment. The census tab falls back to a bundled copy of the backend's actual 2021 Census snapshot if no backend is reachable; the UI labels that state. No live data or accuracy is invented.

## Optional backend connection

Deploy `backend/` on a Node host with the dataset audio available, then set `VITE_API_BASE_URL` to its public HTTPS origin in the Vercel project's environment variables. Redeploy after changing this value. This is a public backend address, not an API key. Keep ElevenLabs credentials only on the backend host.

Without the backend, users can search, score, annotate and export the CSV evidence, and view the census snapshot. They can attach local audio in Analysis settings. Automatic archive audio playback and live Call Check require the separately configured backend. The Vercel deployment does not run the repository's long-running Node server or its Python voice detector.

For microphone-enabled Call Check, include the Vercel website origin in backend CORS_ORIGIN and allow framing by that origin if the backend host adds frame restrictions. Microphone access still requires an explicit user action and browser permission.

Vercel documentation: https://vercel.com/docs/frameworks/frontend/vite and https://vercel.com/docs/project-configuration/vercel-json.

The code is prepared for deployment. No authenticated Vercel account or linked project was available during setup, so no production deployment URL is claimed.
