# LaPeace website PRD

## Current integration

The user reconnected the dashboard after the earlier homepage-only revision. Open dashboard links now open `/dashboard`, which hosts the teammate's actual Mississauga Unheard app from `hisham/wire-site` with isolated CSS and a return link. The Node backend from `hisham/backend` supplies audio and census data. `npm run dev` starts both services. See [integration setup](/docs/dashboard/INTEGRATION.md) for backend configuration, source commits and verification. This supersedes any disconnected-dashboard requirements below.

Murtada owns the frontend. The website explains the accented English speech study through a single public homepage.

## Experience

Visitors arrive at `/`. The main action, Explore the project, scrolls to the research section. Navigation links reach the method, context and sources. There is no dashboard route or dashboard link.

Keep the supplied logo, a concise hero, an asymmetric bento section with the working reference-passage inspector, Mississauga census context and the scripted 311 clarification explanation. Keep the source ledger and footer. Use plain copy, distinct headings and restrained blue/teal accents.

Apple Design from the UI Skills MCP guides hierarchy, typography, press feedback and reduced-motion/transparency/contrast settings. Cursor's Unslop skill guides wording. The reference passage retains its original words.

## Acceptance

- Every internal link reaches an existing homepage section. A direct visit to `/dashboard` shows the same useful return page as any unknown route.
- The homepage makes no API requests and needs no backend.
- Mobile navigation supports Escape and returns focus to its trigger. The passage buttons expose their selection to assistive technology.
- Layouts fit at 360px and support larger text. Controls have visible focus and at least 44px touch targets.
- No autoplay, microphone request, invented metrics or live-agent controls.
- Typecheck, production build and navigation/interaction tests pass. Review real desktop and mobile renders.

Existing dashboard, API and backend source remain available for the teammate's separate application. They are outside the public website's active routes and bundle. Publishing, merging branches and new evaluations are outside this task.
