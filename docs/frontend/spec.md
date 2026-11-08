# LaPeace frontend specification

## Current integration

The user reconnected the dashboard after the earlier homepage-only revision. Open dashboard links now open `/dashboard`, which hosts the teammate's actual Mississauga Unheard app from `hisham/wire-site` with isolated CSS and a return link. The Node backend from `hisham/backend` supplies audio and census data. `npm run dev` starts both services. See [integration setup](/docs/dashboard/INTEGRATION.md) for backend configuration, source commits and verification. This supersedes any disconnected-dashboard requirements below.

## Stack and routes

React, strict TypeScript, Vite, React Router, lucide-react and CSS custom properties. The source is in `web/`, with root convenience scripts. Vitest and React Testing Library verify interactions and route boundaries.

`/` renders the homepage. Unknown routes, including `/dashboard`, render a return link. Static hosting needs an SPA fallback. App.tsx must not import DashboardPage. Retain the teammate's dashboard and API source without connecting them to the website.

Homepage links use real fragment anchors: `#how-it-works`, `#why-it-matters`, `#about-sources` and `#top`. The homepage makes no API requests and needs no environment variables or backend service.

## Components and behavior

HomePage.tsx contains navigation, hero, passage inspector, census/311 descriptions and source attribution. home.css scopes its palette and layout to `.lp-home`. BentoGrid.tsx retains the upstream MIT license and uses optional actions, so information cards need no redundant links.

Use the unchanged bitmap at `/brand/lapeace-logo.png`. Keep the full mark legible in the hero and compact header/footer. Use semantic anchors/buttons, visible keyboard focus, 44px minimum hit targets and rem-based spacing. Keep immediate active feedback, natural scrolling and a solid fallback for reduced transparency. Increased contrast strengthens text and boundaries. Reduced motion removes transforms and transitions.

Follow the connected UI Skills `emilkowalski/apple-design` guidance. Keep Manrope as the established brand font, with optical sizing and size-specific tracking/leading. Apply Cursor's Unslop skill to authored text. Do not rewrite the original archive passage, expose raw transcript HTML, invent evidence or imply illustrative bars are measured audio.

## Verification

Run `npm run typecheck`, `npm test` and `npm run build`. Check the homepage at 1280px, 390px and 360px, including a long passage selection, mobile keyboard navigation, larger text and accessibility preferences. Confirm all internal fragment targets exist, no dashboard links remain, and `/dashboard` performs no API request. Existing disconnected dashboard/API unit tests may remain as preservation checks.
