# AGENTS.md

Instructions for AI agents (and humans) working on this signageOS applet. Read README.md first.

## What this is

A web app (Preact, Tailwind 3) that runs inside signageOS on digital signage players. It loads its content from the Flyo data API (`sos.config.api`) and shows it full screen, unattended, for weeks. Flyo reloads the applet whenever the content changes.

## The one hard rule: old browsers

Players run Chromium 30 and newer (old Tizen, webOS, Samsung SSSP, Android 4.4). Their browser can never be updated. Everything you write must work there.

- The build compiles to ES5 and adds core-js polyfills automatically. Modern syntax is fine in `src/`.
- Not fine, because nothing can add it: `Proxy`, `IntersectionObserver`, `ResizeObserver`, `MutationObserver`, `AbortController`, `Element.closest`, `append`/`prepend`, `structuredClone`, `requestIdleCallback`, dynamic `import()`, `type="module"`.
- CSS: no CSS variables, no grid, no `gap`, no `clamp()`/`min()`/`max()`, no `aspect-ratio`, no `@layer`/`@container`, no modern color functions. Use flexbox with margins, fixed values, `vw`/`vh`.
- Tailwind: only the utilities enabled in `tailwind.config.js` exist. Do not enable more plugins without running `npm test`. Transforms, shadows and gradients go into `src/styles.css`.
- Never put a `<video>` on its own GPU layer and never move or fade it (see `src/views/Video.tsx`).
- Do not add a dependency without a strong reason. If you do, it must not need `Proxy`, and `npm run build` must stay green (Babel transpiles node_modules, `scripts/compat.mjs` checks the result).
- Do not suggest Vue 3, Svelte 5, Alpine, Tailwind 4 or a Vite build: they do not run on these players.

`scripts/compat.mjs` holds the rules with their reasons. When a real device shows a new problem, add a rule there.

## Files

- `src/index.tsx`: entry, global error logging, waits for `sos.onReady()`
- `src/App.tsx`: loads Flyo with retries, loading screen, picks the view
- `src/applet.ts`: settings and all on-screen texts
- `src/flyo.ts`: Flyo API types, loading, parsing, slides, metrics, variables
- `src/sos.ts`: the only file that imports `@signageos/front-applet`
- `src/views/`: Loading, Slideshow, Video. New layouts go here.
- `scripts/postcss-legacy.js`: rewrites Tailwind output for old browsers
- `scripts/compat.mjs`: post-build check (ES5, CSS, browser APIs)
- `tests/`: Vitest

Keep it flat: no new folders or helper files for a few lines. Put code where its topic already lives.

## Conventions

- On-screen texts live in `src/applet.ts`, German, always «du».
- Logs (`log()` in `src/sos.ts`): only on errors, never on normal operation. `type` is `Area.Event`, context as flat fields, errors as `String(error)`. signageOS throttles to about 30 entries per 30 seconds.
- Files from Flyo always go through the offline cache (`cacheFile`), never straight from the URL.
- Every timer you start is cleared when its component unmounts.

## Before you say you are done

Run `npm run verify` (type check, tests, build with compatibility check). All three must pass. UI changes: also look at them with `npm start` in the emulator.

## Flyo API

Docs: https://docs.flyo.cloud/doc/integrations-signage-os-applet

- Response: `{ data, config: { timeout }, vars }`
- «Slides» structure: `data` is an array of items with `image`, `title`, `teaser`, `qrcode`, `metric`, `custom` ... `image` is `false` for entries without image (they become text slides), `custom` is `[]` when empty.
- «Strukturiert» structure: `data` is an object, one list per development identifier, with the integration's own fields
- `vars`: variables by identifier, with the full value of their type
- Each integration's OpenAPI definition (tab «Entwickler») has its exact fields
