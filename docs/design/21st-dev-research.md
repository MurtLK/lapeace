# 21st.dev component research for LAPEACE

Research date: 2026-11-08. Scope: blue/teal LAPEACE homepage, refined typography, quiet motion and a bento composition; React 19 / TypeScript / Vite / plain CSS.

## Connection status and provenance

No 21st.dev MCP tool was callable in this session. The available-tool inventory contained no 21st or Magic tool. Plugin Management searches for `21st` returned no plugin; `21st.dev Magic UI` returned unrelated MagicPath and the installed Figma plugin. The directory search is not exhaustive; additional plugins may exist in the [plugin directory](https://chatgpt.com/plugins).

This work used public catalog pages, Firecrawl retrieval and read-only HTTP retrieval of official upstream source. **No 21st MCP call, authenticated code retrieval, AI generation, plugin installation or global MCP configuration change took place.** The two source references below were downloaded into the documentation vendor folder; they are not installed application components or full templates.

The [official current MCP setup](https://21st.dev/mcp) documents a streamable HTTP server at `https://21st.dev/api/mcp`. Codex setup requires a connected server and an account API key, usually in the `x-api-key` header; CLI login saves a local token. Current docs describe two component-code retrievals per day for free accounts. [The official Magic MCP repository](https://github.com/21st-dev/magic-mcp) says legacy Magic has become a compatibility proxy to that server and old Magic keys were reset. Credentials must be configured through the account/client connection flow, never pasted into chat or committed. No paid plan is necessary for the public source references retained here.

## Recommended components

| Component | Authentic catalog and source | Fit and implementation notes | License/retrieval status |
| --- | --- | --- | --- |
| Magic UI Bento Grid, Dillion Verma | [21st catalog](https://21st.dev/@dillionverma/components/bento-grid), [official docs](https://magicui.design/docs/components/bento-grid), [public registry JSON](https://magicui.design/r/bento-grid.json) | Best reusable foundation. `BentoGrid` controls columns and rows; `BentoCard` separates media, icon, title, description and action. Use a large editorial destination card plus smaller service cards. Translate utility classes into existing CSS; use existing Lucide `ArrowRight`, a plain link, and local class joining to avoid bringing in Tailwind, Radix or a shadcn Button just for this. Preserve real links and ensure actions stay visible on keyboard focus and touch. | Full original source retained locally. Magic UI MIT license retained; include its notice with substantial adaptations. Source has Radix arrow, `cn` and Button imports; registry declares `@radix-ui/react-icons` and `button`. No Motion dependency in this source. |
| Magic UI Blur Fade, Dillion Verma | [21st catalog](https://21st.dev/@dillionverma/components/blur-fade), [official docs](https://magicui.design/docs/components/blur-fade), [public registry JSON](https://magicui.design/r/blur-fade.json) | Small, authentic entrance wrapper for hero copy and section headings. Official defaults: 0.4 seconds, 6px offset and blur; `inView` runs once. Keep blur low, offsets small and delays short; render immediately for reduced-motion users. Content should not remain hidden if observation or animation fails. | Full original source retained locally under MIT. Current upstream uses `motion/react` and registry dependency `motion`; 21st catalog describes older `framer-motion`. Prefer upstream source as dependency authority. No internal Tailwind classes; className simply passes through. Optional plain CSS/IntersectionObserver adaptation avoids a dependency, but must be described as an adaptation rather than an imported Motion component. |
| Aceternity Navbar Menu, Manu Arora | [21st catalog](https://21st.dev/@manuarora700/components/navbar-menu), [official docs](https://ui.aceternity.com/components/navbar-menu) | Optional reference for a calm floating navigation treatment and destination/service menus. Catalog demo uses `Menu`, `MenuItem`, `HoveredLink`, `ProductItem` and React state; catalog lists React, Tailwind and framer-motion. Fit a compact blue/teal brand header and restrained surfaces. Hover-only behavior needs click, touch, focus and Escape handling before reuse. | Catalog/demo inspected only. Component source not retrieved. Public 21st page says source comes with a free account. Aceternity [licence page](https://ui.aceternity.com/licence) addresses Pro with its own end-product and redistribution rules, so it does not establish MIT permission for this particular code. Do not copy unknown source or claim this component imported. |

The Manu Arora [Bento Grid catalog](https://21st.dev/@manuarora700/components/bento-grid) was also inspected. Its scraped usage appeared to match the Magic UI `BentoCard` demo despite different authorship. The preferred bento reference above deliberately uses the verified Magic UI author entry and its own public upstream registry, avoiding that attribution ambiguity.

## Retained source references

All files are in `docs/design/vendor/` and have a `21st-` prefix. They are exact original source/reference downloads, unmodified, for the application builder to adapt and credit:

- `21st-magicui-bento-grid.registry.json`: https://magicui.design/r/bento-grid.json — SHA-256 `2d115c229f9f543eee0c960a1a2f858176c5e6049610f26b30c97cf22f93275b`.
- `21st-magicui-bento-grid.tsx`: source extracted from its registry payload — SHA-256 `9c2abcb2a4e51519e56d510299771a2d0e170ab9927a9a792a58614b1837ed47`.
- `21st-magicui-blur-fade.registry.json`: https://magicui.design/r/blur-fade.json — SHA-256 `e0718ad7f50521f6ec38c75c1bdad29342f80c9ac7bb669a3b3e0a5979f15982`.
- `21st-magicui-blur-fade.tsx`: source extracted from its registry payload — SHA-256 `99a8e83aa8817f48e26d921e959ff9abefb5c2f1f0b72b166ed95e88e015949f`.
- `21st-magicui-LICENSE.md`: https://raw.githubusercontent.com/magicuidesign/magicui/main/LICENSE.md — SHA-256 `0147b84235ed916b8b4e89c1f80655351c5afe7d211b629be61f553a227b34ba`.

No project dependency or application source was changed by this research role. No compatibility/build claim is made for the unintegrated vendor references.

## Suggested application

Use the real supplied logo as the palette anchor, generous near-white surfaces, dark blue body text, and teal/blue primary actions. Adapt the bento structure for useful travel/service content and actual destinations rather than carrying over software-demo content. Keep one dominant hero and one visual bento rhythm. Apply the reveal pattern sparingly, with reduced motion and visible keyboard focus. The homepage builder owns final copy, responsive layout, source integration and build/browser validation.
