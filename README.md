<img src="assets/icon.svg" width="64" height="64" alt="">

# LAPEACE

Created in [T3 Code](https://t3.codes).

A public website about English speech recognition and Mississauga language communities, built with React, TypeScript and Vite.

## Run the website

```sh
npm --prefix web ci
npm run dev
```

Open [the homepage](http://127.0.0.1:5173/). Explore the project scrolls to the research section. The website has no dashboard route and needs no backend.

The teammate's dashboard and API source remain in the repository, disconnected from the website. Hisham's backend remains on its separate branch. No audio or provider credentials are bundled into this website.

## Verification

```sh
npm run typecheck
npm test
npm run build
```

See the [PRD](docs/frontend/PRD.md), [frontend specification](docs/frontend/spec.md) and [design direction](DESIGN.md). The build is implemented directly in code; these documents contain no builder starter prompts.
