<img src="assets/icon.svg" width="64" height="64" alt="">

# LAPEACE

Created in [T3 Code](https://t3.codes).

A public website about English speech recognition and Mississauga language communities, built with React, TypeScript and Vite.

## Run the website

```sh
npm --prefix web ci
npm run dev
```

Open [the homepage](http://127.0.0.1:5173/). Open dashboard opens the LAPEACE research workspace as a full page. `npm run dev` starts both Vite on port 5173 and the Node backend on port 8787.

The integrated dashboard comes from `origin/hisham/wire-site`; the backend comes from `origin/hisham/backend`. See [dashboard setup](docs/dashboard/INTEGRATION.md). Transcript analysis works from bundled CSV files. All 468 recordings have bundled, compressed web previews with source attribution. Census has a bundled snapshot. Provider credentials stay on the backend. Live Call Check requires separate server-side configuration.

## Verification

```sh
npm run typecheck
npm test
npm run build
```

See the [PRD](docs/frontend/PRD.md), [frontend specification](docs/frontend/spec.md) and [design direction](DESIGN.md). The build is implemented directly in code; these documents contain no builder starter prompts.

## Vercel

Import this repository using its root directory. Build settings and dashboard refresh routing are in `vercel.json`. See [deployment setup](docs/dashboard/VERCEL.md) for the optional backend connection and offline limits.
