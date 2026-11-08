# LaPeace Homepage Upgrade Implementation

## Files Modified and Created

- [`web/src/components/home/BentoGrid.tsx`](../../web/src/components/home/BentoGrid.tsx) *(new)*
- [`web/src/pages/HomePage.tsx`](../../web/src/pages/HomePage.tsx) *(updated)*
- [`web/src/pages/home.css`](../../web/src/pages/home.css) *(updated)*
- [`docs/design/homepage-upgrade-implementation.md`](homepage-upgrade-implementation.md) *(new)*

No dashboard files, routing configuration, API modules, global tokens (`web/src/styles/tokens.css`), dependencies (`web/package.json`), tests, backend, or pipeline files were modified.

## What Changed

### 1. Brand Identity & Scoped Palette (`lapeace-logo.png`)
- **Logo Integration:** Applied the original user-supplied 1536×1024 bitmap (`/brand/lapeace-logo.png`) in three intentional placements without modifying or tracing the bitmap:
  - **Header (`lp-brand-link`):** Compact framed mark linking to `/` with `aria-label="LaPeace home"` and decorative `alt=""` inside `aria-hidden="true"` to avoid duplicate text announcement.
  - **Hero Brand Card (`lp-hero__brand-card`):** Prominent white-surface frame showing the complete uncropped 3:2 dove, speech-wave bars, and navy LaPeace wordmark with a concise Sheridan Datathon project caption.
  - **Footer (`lp-footer__logo-link`):** Framed colophon mark linking to `/`.
- **Scoped Navy / Blue / Teal / White Tokens:** Declared `--lp-*` OKLCH color variables in `web/src/pages/home.css` and mapped them inside `.lp-home` so the homepage adopts deep navy ink (`--lp-ink`), bright ocean blue primary actions (`--lp-accent`), teal supporting accents (`--lp-teal`, `--lp-teal-soft`), and cool near-white/white surfaces while leaving the separate `/dashboard` green token baseline completely untouched.

### 2. Magic UI Bento Grid Adaptation & Provenance
- **Source Adapted:** Adapted `BentoGrid` and `BentoCard` from the verified public upstream Magic UI registry source saved at [`docs/design/vendor/21st-magicui-bento-grid.tsx`](vendor/21st-magicui-bento-grid.tsx) and [`docs/design/vendor/21st-magicui-bento-grid.registry.json`](vendor/21st-magicui-bento-grid.registry.json).
- **License & Attribution:** Preserved full MIT license text and upstream attribution (`Magic UI`, Dillion Verma) in the header of [`web/src/components/home/BentoGrid.tsx`](../../web/src/components/home/BentoGrid.tsx), per [`docs/design/vendor/21st-magicui-LICENSE.md`](vendor/21st-magicui-LICENSE.md).
- **Plain-CSS & Dependency-Free Translation:** Replaced Tailwind utilities, `@radix-ui/react-icons`, `cn`, and shadcn `Button asChild` with semantic `<article>` markup, local class joining, `react-router-dom` `<Link>` for internal routes (`/dashboard?tab=...`), and `lucide-react` `ArrowRight`. Always-visible footer action links replace the hover-only desktop CTA reveal so touch and keyboard users have permanent 44px+ targets.
- **No 21st MCP Call Claimed:** As documented in [`docs/design/21st-dev-research.md`](21st-dev-research.md), no authenticated 21st.dev MCP call was executed; the component was adapted from the retained official public registry files.

### 3. Asymmetric Bento Layout & Functional Reference Inspector
- **Hero:** Kept the short editorial headline (`Every voice deserves to be heard.`), concise supporting sentence (`Real recordings. Local context. Clearer conversations.`), and primary `Open Dashboard` CTA above the desktop fold alongside the prominent LaPeace brand card.
- **Dominant Bento Tile (`lp-bento-card--dominant`, 7 columns × 2 rows on desktop):** Houses the interactive Speech Accent Archive reference passage inspector (`STELLA_SEGMENTS`) and links to `/dashboard?tab=evidence`.
  - Preserves all 4 canonical sentence buttons with accessible full-phrase `aria-label`s and `aria-pressed` state.
  - Default quote displays `"Please call Stella."` and clicking the final segment button displays `"She can scoop these things into three red bags, and we will go meet her Wednesday at the train station."`
  - Labels the SVG bar geometry as `Illustrative waveform` and states in the caption that the passage is a supplied reference, actual speaker readings may vary, and the waveform is illustrative rather than a live or measured audio signal.
- **Supporting Bento Tiles (5 columns each on desktop, stacked on mobile):**
  - **Mississauga language context (`/dashboard?tab=community`):** Explains the 11-ward 2021 Census home-language profiles and explicitly notes that census counts provide civic context rather than measured English transcription accuracy.
  - **Clarifying service requests (`/dashboard?tab=clarification`):** Highlights initial intake and read-back confirmation steps for scripted 311 requests on a soft teal-tinted surface (`lp-bento-card--teal`).

### 4. Apple Design / HIG & Accessibility Compliance
- **Skill Provenance:** Applied the retrieved [`emilkowalski/apple-design`](skills/emilkowalski-apple-design.md) and [`justinwetch/apple-hig`](skills/justinwetch-apple-hig.md) guidance honestly (exact `apple-taste` was unavailable in registries).
- **Controls & Focus:** Minimum 44px hit targets on all buttons and navigation links, immediate `:active` press feedback (`scale(0.98)`), instant `:focus-visible` outlines, Escape-to-close mobile drawer with focus restoration to the menu button, `prefers-reduced-motion: reduce`, and `prefers-reduced-transparency: reduce` fallbacks.

## Verification & Checks Run

All verification commands were executed from `/Users/murtadalakhdar/.t3/projects/lapeace` and passed:

1. `npm --prefix web run typecheck` — passed (`tsc --noEmit`, 0 errors).
2. `npm --prefix web run build` — passed (`tsc --noEmit && vite build`, production bundle generated cleanly).
3. `npm --prefix web run test:run` — passed (`3 passed` test files, `14 passed` tests across `api.test.ts`, `DashboardPage.test.tsx`, and `App.test.tsx`, including homepage navigation, zero homepage `fetch` calls, mobile menu `Escape` + focus restoration, and reference passage inspector phrase selection).
4. `node .agents/skills/hallmark/scripts/sloplint.mjs web/src/pages/HomePage.tsx web/src/pages/home.css web/src/components/home/BentoGrid.tsx --genre editorial` — passed (`0 FAIL, 0 WARN, 1 WAIVED, 1 DISMISSED`).

## Limitations

Root integration completed afterward: compact logos now use `object-fit: contain`, all homepage palette declarations are scoped to `.lp-home`, and global `html`/`body` rules were removed from the homepage stylesheet. Root reran typecheck, build and all 14 tests successfully. Fresh desktop/390px/360px captures had no page errors or horizontal overflow. Independent Antigravity finish review returned **ship**, with no material fixes. See `website-verification.md` for the final verification record.

- No live browser screenshots or dev-server restarts were performed in this sub-agent pass, as screenshot capture and independent visual review are handled by the root orchestrator.
- The homepage intentionally makes no network requests, plays no audio, and invents no benchmark metrics or partner claims; live dataset inspection remains in `/dashboard`.
