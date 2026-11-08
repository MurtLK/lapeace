# Website integration and verification

## Current dashboard wiring

The dashboard has been reconnected at the user's request. The full teammate workspace from `hisham/wire-site` replaces the disconnected prototype as the active dashboard. Backend integration, real browser evidence and the 15 passing tests are recorded in `docs/dashboard/INTEGRATION.md`. Earlier single-page and removed-route assertions below are historical.

## Current website revision, November 8, 2026

The user removed the dashboard from the public website. App.tsx no longer imports or routes DashboardPage, homepage links use existing section anchors, and metadata/no-JavaScript copy no longer mention a dashboard. The teammate's dashboard and API source remain disconnected for separate use.

Loaded `emilkowalski/apple-design` through the connected UI Skills MCP and installed `cursor/plugins@unslop` via Find Skills. Verified the official Cursor repository and the skill listing, which reported about 33.4K installs and 15.7K repository stars. Sources: https://skills.sh/cursor/plugins/unslop and https://github.com/cursor/plugins. The installed instructions are in `.agents/skills/unslop/SKILL.md`.

Applied plain, project-specific wording, removed forced three-part slogans and redundant card actions, reduced nested containers, preserved Manrope with optical sizing and size-specific hierarchy, converted spacing tokens to rem, and added increased-contrast support. Immediate press feedback, reduced motion and reduced transparency remain. The archive passage stays verbatim; each button's accessible name now includes its visible label.

Verified 20 homepage anchors/links, valid fragment destinations, zero API calls, mobile Escape/focus restoration, long passage selection and a useful return page on a direct `/dashboard` visit. Chrome captures at 1280px, 390px and 360px showed no page errors or horizontal overflow. At 200% root text size on a 390px viewport, the grid and controls reflowed without oversized elements or clipping. Sampled body and waveform-label text exceeded 7.6:1 contrast against white. Reduced-motion behavior passed. All 14 tests, typecheck and production build passed. PRD, spec, product brief and README now describe the single-page website.

Earlier verification below records prior milestones, including their dashboard behavior and review. Those claims do not describe the current route scope. No new independent delegate review was run for this revision.

## Earlier homepage upgrade — November 8, 2026

This section supersedes the earlier homepage appearance and review below. The public homepage now uses the supplied LaPeace logo, scoped navy/blue/teal colors, and an asymmetric bento layout adapted from the retained MIT Magic UI registry source. Dashboard code and global tokens were not changed for this upgrade.

Root fixed the compact header/footer logo treatment to contain the full mark and moved all homepage palette declarations into `.lp-home`. After these final changes, typecheck, production build and all 14 tests passed. Fresh Chrome captures at 1280×800, 390×844 and 360×800 showed no page errors or horizontal overflow. The primary desktop action remains above the fold.

A separate Antigravity finishing reviewer inspected the current captures and source and returned **ship**, with no material fixes. The review used the supplied logo and written brief; no approved visual comp or formal Apple certification was claimed.

21st.dev MCP is registered but authentication remains incomplete. Actual component reuse comes from the verified public Magic UI registry source, with full MIT attribution preserved. Retrieved Apple Design and Apple HIG guidance was used; the exact `apple-taste` skill was unavailable. No deployment, commit or push was performed.

The homepage and dashboard are implemented directly in React/TypeScript. Antigravity wrote the initial homepage, Codex wrote the app foundation, and root integrated the work and tightened homepage wording and interactions. The prior AGENTS.md instructions were revoked by the user. The PRD and spec contain no builder starter prompts.

## Delivered

- Public homepage with desktop/mobile navigation, a source-labelled reference-excerpt inspector, project sections, sources and footer.
- Open Dashboard links and a separate dashboard with Evidence, Community and Clarification views, return navigation, request cancellation and honest unavailable states.
- Shared Manrope/mint design tokens, responsive layouts, keyboard focus and reduced-motion/transparency support.
- Installed Impeccable and Hallmark support files. Apple Design and Apple HIG skill entries were retrieved from the existing connected UI Skills MCP; no duplicate MCP connection was necessary. These are design influences, not a claim of formal Apple certification or exhaustive native-platform HIG enforcement.
- Design direction in DESIGN.md and observed-system extension metadata in .impeccable/design.json. Existing DESIGN.md was preserved.

## Commands actually passed

- npm run typecheck
- npm test: 14 tests across 3 files
- npm run build
- Hallmark static plus rendered check at 1280, 1440, 1920 and mobile: 0 FAIL, 1 WARN (88 words in the densest viewport), 3 explicit waivers and 1 design-supported dismissal. No clean-lint claim is made for warnings/waivers.

## Browser verification

Captured actual renders with local fonts at 1280x800, 390x844 and 360x800. No page errors or horizontal overflow. The desktop headline, supporting sentence and primary action are above the fold. Tested the mobile menu, Escape and focus restoration, reference selection, homepage/dashboard navigation, direct dashboard refresh, return scroll reset and reduced motion.

For integration only, read the existing origin/hisham/backend into a temporary directory and ran its real Node server in fixture mode. Verified the simulated-data badge, audio range response 206 with 100 requested bytes, all 11 census wards, and clarification replay advancement through the local frontend proxy. The homepage made no API calls. All observed API requests were GET; no provider call, microphone use or live agent session was started. Temporary backend verification service was stopped afterward. The frontend remains available at http://127.0.0.1:5173/ while its development session runs.

## Independent finish review

A fresh Codex finish reviewer inspected the actual desktop/mobile captures and source against PRODUCT.md and DESIGN.md. Disposition: **ship**, with no material fixes at the reviewed scope. No separate approved visual comp or quality-bar card existed, so the reviewer did not claim compliance with those absent inputs. The warning and explicit design waivers were assessed as non-material at this scope.

## Remaining integration boundary

Hisham's backend and dataset audio are not bundled into this frontend. Run that existing backend separately for real evidence; use web/.env.example for a hosted address. The default proxy targets port 8787. If no service runs there, dashboard unavailable states are intentional. Comparison charts and live voice controls are beyond this homepage-first slice. No deployment, merge, push or commit was performed.
