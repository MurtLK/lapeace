# LAPEACE design direction

## Current website scope

The public website is a single homepage. The user removed the dashboard on November 8, 2026. All active actions lead to homepage sections or real source websites. The dashboard source remains disconnected for the teammate. This overrides earlier dashboard directions below.

Use Apple Design retrieved from UI Skills MCP: clear purpose, size-specific type hierarchy, immediate press feedback, stable spatial relationships, accessible text scaling and reduced-motion/transparency/contrast settings. Keep Manrope as the established brand typeface with optical sizing. Remove redundant card actions, nested decorative containers and repeated prose. Cursor's Unslop skill guides plain factual copy. Preserve the original logo, reference passage and source distinctions.

## Voice in the open

The user now supplies a LaPeace logo and requests a bento layout. Follow [the homepage upgrade brief](docs/design/homepage-upgrade-brief.md) for a white/navy/blue/teal homepage refinement. The green token descriptions below record the prior baseline and remain relevant to the separate dashboard, which is outside this refinement.

An Apple-inspired civic research website: near-white canvas, ink typography, considered mint-green accents, generous spacing and a restrained translucent navigation layer. It should feel composed, tactile and welcoming. Avoid decorative gradients, generic icon-card grids, fake browser windows and an admin dashboard as the first page.

Public homepage: one clear headline and a short sentence; primary Open Dashboard action; a distinctive sound/transcript visual grounded in the project; editorial sections about listening, comparing and clarifying; meaningful sources/about content; quiet footer. No invented evidence. Decorative sound geometry must not appear to be measured data or playable audio unless it has a real media source.

Dashboard: a separate route with evidence/community/clarification tabs, clear unavailable/error states and a return link. Use source-backed APIs and accessible native audio. The homepage is the priority.

## Shared tokens and craft

- Fonts: Manrope for a warm, open humanist voice, with system-ui fallback. Keep families, colors and key dimensions in CSS variables.
- Color roles: canvas near-white, white elevated surfaces, ink #17251f, secondary ink #59675f, accent #2c6b4e, accent surface #e5f1e7. Agents may refine accessible values in the token block; no arbitrary colors elsewhere.
- One centered container, max-width 1200px; generous responsive gutters; fluid headings no more than 6rem with tracking no tighter than -0.04em.
- Touch controls at least 44px in their interactive area. Visible keyboard focus, semantic navigation, descriptive link text and correct button/link semantics.
- Native scroll, no autoplay, no hijacked pointer. Instant press feedback, short intentional transitions, reduced-motion and reduced-transparency fallbacks.
- The headline, supporting sentence and primary action must fit in the first 1280x800 viewport. Mobile at 360px has no horizontal overflow.
- Use actual links for / and /dashboard, with direct-route refresh and browser Back support. Never put an arrow character into link text; use a library icon separately if needed.

## Skill references

The Apple Design and Apple HIG entries were retrieved using the connected UI Skills MCP. Impeccable and Hallmark were retrieved from that MCP and installed with their supporting files under .agents/skills/. The original tool responses are preserved under docs/design/skills/. Apply compatible guidance; user scope and platform instructions take precedence over skill-specific setup or browser rules.
