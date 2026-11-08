# LaPeace homepage upgrade

Use the supplied LaPeace dove/speech-wave logo, Apple Design/HIG guidance and a responsive bento layout. The teammate owns the dashboard. Change the public homepage only; preserve `/dashboard` and its tab destinations for later wiring.

## Brand asset

`web/public/brand/lapeace-logo.png` is the unchanged user-supplied 1536x1024 PNG. Use it in header/footer and a suitable prominent brand area. Navy, blue and teal replace the old green homepage direction. Preserve aspect ratio, avoid stretching/tracing, and integrate the white background intentionally. CSS presentation may reduce excess whitespace; preserve the full logo identity in at least one prominent placement. Do not edit the bitmap or generate a replacement.

## Design

- A calm, clear hero with the Open Dashboard primary action above the desktop fold.
- One asymmetric bento section: a larger speech/reference tile, community context and clarification. Different content/compositions rather than repeated icon cards. Link each to its existing dashboard tab.
- Keep a working reference excerpt inspector and clear illustrative labels. No fabricated scores, testimonials, heatmaps, measured waveforms or partner claims.
- White/navy/blue/teal tokens, refined typography, large rounded surfaces and restrained motion. Scope homepage colors so the dashboard is unchanged.
- Accessible at 360px, keyboard focus and touch targets, no autoplay, no live sessions, reduced-motion/transparency fallbacks.

## Research

Read `homepage-upgrade-skills.md` and `21st-dev-research.md` as they arrive. Exact apple-taste was not found; Apple Design and Apple HIG are available through UI Skills MCP. No 21st/Magic MCP or matching connected plugin was found. Public catalog research is distinct from MCP use. Preserve actual upstream component licenses/attribution; do not claim imports or tool calls that did not occur.

## Ownership

Antigravity: HomePage.tsx, home.css, new homepage-only components/styles and implementation handoff. Codex researchers: their own notes/source references. Root: asset preparation, integration/tests/docs. Fresh reviewer: read-only after implementation. Dashboard, routing, package files and global tokens stay outside the builder's write scope.
