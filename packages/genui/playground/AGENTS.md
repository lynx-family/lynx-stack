# genui-playground (packages/genui/playground)

This package is a playground app for `@lynx-js/genui/a2ui`.

It supports:

- `web` via `@rsbuild/core` (React DOM preview)
- `lynx` via `@lynx-js/rspeedy` (Lynx preview)
- zero-build Lynx XML examples loaded directly by Lynx for Web

## How It Works (Web Shell vs Lynx App)

There are two different things in this package:

- A React DOM "control panel" (the UI you click in your browser)
- A Lynx app (the thing that actually renders A2UI via ReactLynx + `A2UIRender`)

The "control panel" does not render A2UI directly. Instead it constructs an `initData`
payload (messages + optional action mocks), then opens a preview runtime that loads
the Lynx app and passes that `initData` to it.

## Web Preview Architecture

Web build has two entrypoints (see `rsbuild.config.ts`):

- `src/entry.tsx`: the main control panel (tabs: Create / Examples / Components)
- `src/render.tsx`: a dedicated page (`/render.html`) that hosts a `<lynx-view>`

`/render.html` is the important glue:

- It imports `@lynx-js/web-core/client` and `@lynx-js/web-elements/all` to register
  the `<lynx-view>` custom element.
- It creates `<lynx-view url="/main.web.js" ... />` (see `src/render.tsx`).
- It passes `initData` to the element via `lynxView.initData`, then triggers a
  reload when the init data changes.

The control panel builds a `/render.html?...` URL with base64-encoded payload
(`src/utils/renderUrl.ts`) and embeds it in an `<iframe>`(see `PreviewViewport.tsx`).

## Lynx App Architecture (What Runs Inside <lynx-view>)

The Lynx app entry is `lynx-src/index.tsx`, which renders `lynx-src/App.tsx`.

Inside `lynx-src/App.tsx`:

- It imports `@lynx-js/genui/a2ui/catalog/all` to register catalog components.
- It reads `initData` via `useInitData()` (this is how `<lynx-view>` passes data
  into the Lynx runtime).
- It uses `BaseClient` + `client.processor.processMessages(...)` to replay the
  provided messages over time (simulated streaming).
- It renders the result via `<A2UIRender resource={resource} />`.
- It can also mock "actions" by overriding `client.processUserAction` and replaying
  action-specific response messages.

## Web vs Lynx Relationship

- The A2UI rendering logic is the same in both targets: it is always the Lynx app
  (`lynx-src/App.tsx`) that runs `A2UIRender`.
- The difference is which bundle is loaded:
  - Web preview loads `www/main.web.js` via `<lynx-view url="/main.web.js" />`.
  - Native Lynx preview (rspeedy) builds `www/main.lynx.js` and runs it in the
    Lynx runtime (device/simulator), still using the same `lynx-src/*` sources.

## Key Files

- Web config: `rsbuild.config.ts`
- Lynx config: `lynx.config.ts`
- Web entrypoints: `src/entry.tsx`, `src/render.tsx`
- Lynx entrypoint: `lynx-src/index.tsx`
- Lynx XML examples: `src/mock/lynx-xml/*.lynxml`

## Lynx XML Examples

The `lynx-xml` protocol currently exposes only the Examples tab. Its example
files are imported as raw source for the shared detail workspace and copied to
`dist/demos/lynx-xml/` for the list previews. `render.html` passes the complete
artifact URL to `<lynx-view>`; do not add a ReactLynx renderer or a per-example
Rspeedy build for these files. Keep each Element PAPI tree directly under its
page rather than adding a generic `app` wrapper. Lynx defaults to Linear
layout, so every class used as a layout container must explicitly declare
`display: flex` and the intended direction where it matters. Keep `page`
unstyled and place viewport sizing, background, and entry layout on the first
business view. When content can exceed one viewport, make that entry node a
vertical scroll view instead of adding another wrapper.

## Common Commands

Run from repo root:

```bash
# Web
pnpm -C packages/genui/playground dev
pnpm -C packages/genui/playground build
pnpm -C packages/genui/playground preview

# Lynx
pnpm -C packages/genui/playground dev:lynx
pnpm -C packages/genui/playground build:lynx
pnpm -C packages/genui/playground preview:lynx
```

## Output

- The generated assets are configured to land in `www/` (see `lynx.config.ts` `output.distPath.root`).
