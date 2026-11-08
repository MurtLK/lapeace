# Deploy on Vercel

Import https://github.com/MurtLK/lapeace into Vercel. Use the repository root as Root Directory, not `web`. The committed `vercel.json` sets install, build, output and `/dashboard` refresh rewrites. Node 24 is required.

The homepage opens the research dashboard as a native full-page app. It has its own Back to website and Dashboard guide links. The 468-recording transcript analysis, compressed source audio previews, census snapshot and multilingual results work as static files without a backend. Audio is lazy-loaded from `/dashboard-app/audio/` only when requested. Previews total about 80 MB and include attribution, license and a hash manifest.

The build copies the canonical Call Check browser interface from `backend/public/call-check.html` into the dashboard's static assets. It matches the dashboard palette and resizes to fit its contents. Its explanation and source links work offline; live transcription needs the backend.

## Live Call Check

Run `backend/` on a Node host. Set ELEVENLABS_API_KEY in that host's private environment. Set CORS_ORIGIN to include the Vercel website origin. Set VITE_API_BASE_URL in Vercel to the backend's public HTTPS origin and redeploy. That address is public; the API key must never be a VITE variable or committed to Git.

GET `/api/callcheck/status` returns configuration booleans only. The Record button remains disabled if the live backend or its key is missing. This readiness check does not spend transcription credits or validate provider permissions. The optional Python voice detector needs its own backend configuration.

Vercel does not run this repository's long-running backend or Python detector. Local backend environment values are not automatically installed on a hosted backend. No production deployment URL is claimed here.

References: https://vercel.com/docs/frameworks/frontend/vite and https://vercel.com/docs/limits.
