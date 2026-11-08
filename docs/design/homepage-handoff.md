# LAPEACE Homepage Handoff

## Owned Files Written

- `web/src/pages/HomePage.tsx`
- `web/src/pages/home.css`
- `.hallmark/log.json`
- `docs/design/homepage-handoff.md`

## Component Contract & Integration

- **Export:** Named `HomePage` component (`export function HomePage()`) plus default export (`export default HomePage`), accepting no required props.
- **Styles:** Imports `./home.css` directly.
- **Dependencies used:** `react`, `react-router-dom` (`Link`), `lucide-react` (`ArrowUpRight`, `Menu`, `X`).
- **Routes linked:**
  - `/` (wordmark in header and footer)
  - `/dashboard` (header action, mobile drawer CTA, hero primary CTA, footer link)
  - `/dashboard?tab=evidence` (Measured recognition evidence pillar & Why it matters section CTA)
  - `/dashboard?tab=community` (Mississauga language context pillar & 2021 Census row in Sources)
  - `/dashboard?tab=clarification` (Clarifying service requests pillar)
- **Internal section anchors:**
  - `#main-content` (skip link target)
  - `#how-it-works` (Three lenses on voice access)
  - `#why-it-matters` (Why careful provenance matters)
  - `#about-sources` (Sources and methodology)
- **External attribution links:**
  - `https://accent.gmu.edu` (Speech Accent Archive at George Mason University)
  - `https://elevenlabs.io` (ElevenLabs Scribe v2 baseline reference)

## Shared CSS Custom Properties Consumed

`web/src/pages/home.css` maps and consumes the shared tokens specified in `DESIGN.md` with accessible OKLCH fallbacks so the homepage renders cleanly standalone or alongside the shared root stylesheet:

- `--font-sans`
- `--color-bg`
- `--color-surface`
- `--color-ink`
- `--color-muted`
- `--color-accent`
- `--color-accent-soft`
- `--color-border`
- `--color-focus`
- `--radius-sm`, `--radius-md`, `--radius-lg`
- `--container`

All homepage-specific colors, translucent surfaces, shadows, and spacing steps are declared in `:root` token variables; zero literal colors or font families appear in CSS rule bodies.

## Design & Accessibility Summary

- **Apple Design & HIG Alignment:** Restrained near-white/mint surface hierarchy, translucent sticky navigation with `prefers-reduced-transparency: reduce` fallback, instant `:active` press scaling (`scale(0.98)`), instant `:focus-visible` outlines, 44px+ minimum hit targets on all interactive controls, and `prefers-reduced-motion: reduce` support.
- **Interactive Signature Visual:** An interactive Speech Accent Archive reference passage inspector (`Please call Stella...`) that lets visitors inspect each of the four canonical sentences, its phonetic load, evaluation lens, and civic service impact alongside clearly labelled illustrative acoustic geometry (no fake audio playback controls or fabricated metrics).
- **Static Verification:** Passed Hallmark `sloplint.mjs` (`0 FAIL, 0 WARN, 1 WAIVED, 1 DISMISSED`).
