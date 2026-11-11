# Flyo signageOS Applet

Starter for [signageOS](https://www.signageos.io/) applets that show content from [Flyo](https://flyo.cloud). Out of the box it plays the integration's slides full screen (images, videos, and entries without image as text slides), with a slide transition, QR codes, Flyo metrics, logs and automatic retries. It is built with Preact and Tailwind and compiled to ES5, so it also runs on old TV browsers.

Flyo docs: [Applet entwickeln](https://docs.flyo.cloud/doc/integrations-signage-os-applet).

## Requirements

- Node.js 22.12 or newer
- A [signageOS Box](https://box.signageos.io/) account with an organization
- Players with Chromium 30 or newer, or a comparable WebKit: Tizen 2.4+, webOS 1+, Samsung SSSP2+, Android 4.4+, BrightSign, Raspberry Pi ([browser per platform](https://docs.signageos.io/devices/device-guides/general-information/browser-webkit-and-chromium-versions-by-each-platform)).

## First setup

1. Clone the repository and run `npm install`.
2. In `package.json`, set `name` (this becomes the applet name in signageOS and Flyo) and reset `version`.
3. Log in to signageOS: `npx sos login`, then `npx sos organization set-default`.
4. Copy `sos.config.local.example.json` to `sos.config.local.json` and put in the API URL of your integration. You find it in Flyo: integration, tab «Entwickler». The file is not committed.

## Daily work

| Command | What it does |
| --- | --- |
| `npm start` | Emulator on http://localhost:8090 with the real signageOS API, rebuilds on save |
| `npm test` | Unit tests and the Tailwind compatibility test |
| `npm run build` | Builds `dist/`, then checks it for old browsers (`scripts/compat.mjs`) |
| `npm run release` | Type check, tests, build, then upload to signageOS. Raise `version` first. |

After the first upload, choose the applet in the Flyo integration (tab «Konfiguration», «Applet»). Flyo reloads the screens on every content change. To test on a real device: `npx sos device connect --device-uid <uid> --hot-reload`.

### On a remote machine (SSH, VM)

The emulator needs nothing on the server but Node. Open it in the browser on your own machine, always via `localhost`:

- Forward both ports: `ssh -L 8090:localhost:8090 -L 8172:localhost:8172 <server>` (VS Code Remote forwards them on its own). 8090 is the emulator, 8172 the live reload.
- Do not open it via the server's IP: on plain `http://<ip>` the browser switches off service workers and crypto, and the offline cache and the emulator's device registration break.
- `npx sos login` works over SSH: it prints a URL and a code that you open on your machine.
- Port 8172 taken? `DEV_PORT=8173 npm start`, and forward that port instead.

The emulator writes some errors to the browser console that are not caused by the applet and can be ignored: `wss://gateway.root.signageos.io` failed, `Device.Telemetry … has timed out`, `Registration failed`, and 404s on `indexed_db/…` (the emulator's own screenshots).

## Where to change what

- `src/applet.ts`: timings, retries and every text on the screen
- `src/styles.css`: transition, loader animation and other global CSS
- `src/views/`: the screens. Another layout (split screen, menu board, the «Strukturiert» data) is a new component here, rendered from `src/App.tsx`.
- `src/flyo.ts`: the Flyo API. Types for one specific integration can be generated from its OpenAPI definition (tab «Entwickler»): `npx openapi-typescript <url> -o src/flyo-api.d.ts`
- `src/sos.ts`: everything that talks to signageOS (config, logs, offline cache)

Variables: the applet shows the text variable `notice` as a bar over the slides, if the integration defines one. Read other variables from `response.vars` the same way (`textVar` in `src/flyo.ts`).

## Old TV browsers

Many players run Chromium 30 to 50 and cannot be updated. The build compiles everything to ES5 and adds polyfills, and `npm run build` fails when something slips through. What does not work, and what to use instead:

| Does not work | Why | Instead |
| --- | --- | --- |
| Vue 3, Svelte 5, Alpine | Need `Proxy` (Chromium 49), cannot be polyfilled | Preact |
| Tailwind 4 | Needs Chromium 111 (`@layer`, `oklch`, `@property`) | Tailwind 3.4, cut down in `tailwind.config.js` |
| Tailwind transforms, shadows, rings, gradients, filters | Built on CSS variables (Chromium 49) | Plain CSS in `src/styles.css` |
| `gap`, `space-x`, CSS grid | Chromium 84 / 57 | Flexbox with margins |
| CSS variables, `clamp()`, `aspect-ratio` | Chromium 49 / 79 / 88 | Fixed values, `vw`/`vh` |
| `type="module"`, `import()` | Chromium 61, and an applet must be one offline bundle | Static imports, one bundle |
| `IntersectionObserver`, `AbortController`, `Element.closest` | Browser APIs, core-js cannot add them | Timers, `fetchWithTimeout`, `parentNode` |
| Moving or fading a `<video>` | TV decoders stop painting it | Videos leave with a hard cut, see `src/views/Video.tsx` |

Test in a browser as old as your oldest player when in doubt: signageOS links [old Chromium builds](https://docs.signageos.io/devices/device-guides/general-information/browser-webkit-and-chromium-versions-by-each-platform).

## Logs

The applet only logs when something goes wrong. Flyo shows the entries per screen: integration, tab «Bildschirme», info icon, «Logs anzeigen».

| type | When |
| --- | --- |
| `Flyo.LoadFailed` | Loading the API failed, retried every 10 s, at most 15 times |
| `Flyo.MissingApi` | The applet has no `api` configuration |
| `Content.CacheFailed` | A file could not be cached, the slide is skipped |
| `Video.Ended` | A video stopped because of an error, the slide is skipped |
| `Applet.Error` / `Applet.UnhandledRejection` | An unexpected JavaScript error |

## CI

`.github/workflows/ci.yml` and `.gitlab-ci.yml` run `npm run verify` on every push. Keep the one for your host and delete the other.
