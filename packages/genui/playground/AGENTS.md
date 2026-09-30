# GenUI Playground

This package provides the React DOM playground for `@lynx-js/genui`, supporting
A2UI, OpenUI, MCP Apps, ReactLynx, ReactWeb, Lynx XML, and HTML. Keep shared UI in the Web
shell and protocol rendering in its preview runtime. Detailed feature conventions
live in
[the Playground instructions](../../../.github/genui-playground.instructions.md).

## Runtime Architecture

`src/entry.tsx` starts the Web shell. `PreviewViewport` selects the preview
surface for each protocol:

| Protocol  | Web preview                                                | Renderer source               |
| --------- | ---------------------------------------------------------- | ----------------------------- |
| A2UI      | `render.html` hosting `<lynx-view>`                        | `lynx-src/a2ui/`              |
| OpenUI    | `render.html` hosting `<lynx-view>`                        | `lynx-src/openui/`            |
| MCP Apps  | `render.html` hosting `<lynx-view>`                        | `lynx-src/mcp-apps/`          |
| ReactLynx | `render.html` hosting `<lynx-view>`                        | Server-built ReactLynx bundle |
| ReactWeb  | `render.html` hosting a sandboxed `HtmlView`               | Server-built React DOM HTML   |
| Lynx XML  | Direct `LynxXmlView`; `render.html` for example/share URLs | Complete `.lynxml` source     |
| HTML      | Sandboxed `HtmlView` iframe using `srcDoc`                 | Complete HTML source          |

For bundled protocols, `src/utils/renderUrl.ts` constructs the preview URL and
payload. `src/render/index.tsx` selects the protocol implementation from
`src/render/`. Shared query parsing, metrics, and bundled view lifecycle live
in `query.ts`, `metrics.ts`, and `bundled.ts`; protocol modules own their data
loading and action bridges. A2UI uses `A2UI`, a message store, and a mock agent
for playback and action responses in `lynx-src/a2ui/App.tsx`.

Web and native previews share the same `lynx-src/<protocol>/` implementation.
`lynx.config.ts` builds `www/<protocol>.web.js` and
`www/<protocol>.lynx.js` for `a2ui`, `openui`, and `mcp-apps`.

ReactLynx uses generated standalone bundles instead of a checked-in
`lynx-src/` renderer. Current, historical, and shared previews fetch the
published Web bundle directly from TOS. The TOS bucket must allow anonymous
reads and CORS requests from every deployed Playground origin. The
`render.html` ReactLynx renderer enforces the bundle size limit, creates a Blob
URL, and loads it directly in `<lynx-view>`.

## File Ownership and Outputs

| Location                                         | Responsibility                                  |
| ------------------------------------------------ | ----------------------------------------------- |
| `src/pages/`                                     | Shared pages and protocol adapters              |
| `src/components/PreviewViewport.tsx`             | Preview surface selection                       |
| `src/components/LynxXmlView.tsx`, `HtmlView.tsx` | Direct source previews                          |
| `src/utils/renderUrl.ts`, `src/render/`          | Preview URLs and protocol-specific Web runtimes |
| `lynx-src/<protocol>/index.tsx`, `App.tsx`       | Bundled Lynx renderers                          |
| `src/mock/lynx-xml/*.lynxml`                     | Lynx XML examples                               |
| `rsbuild.config.ts`                              | Web entries, raw XML imports, and asset copying |
| `lynx.config.ts`, `lynx-lazy.config.ts`          | Main and lazy Lynx bundle configuration         |
| `turbo.json`                                     | Build dependencies and cached outputs           |

Rspeedy outputs bundles to `www/`. Rsbuild serves that directory during
development and copies it into the Web output in `dist/` during builds.
XML example sources are copied unchanged to `dist/demos/lynx-xml/`.

## Lynx XML

### Create and Preview

Lynx XML exposes Create, Examples, and the shared Bench tab at `#/bench`;
Catalog is unavailable. Keep the hook-free Create adapter in
`src/pages/chat/lynx-xml.ts` and stream from `/lynx-xml/stream`.
Update the source viewer for usable partials, but preview only complete documents.

Generated and edited XML uses a browser-local XML Blob URL as the LynxView
`url` input. `PreviewViewport` mounts `LynxXmlView` directly. Example/share
URLs use `render.html?protocol=lynx-xml`, whose XML branch also renders the
complete artifact directly. Do not route XML through bundled protocol
renderers, init data, global props, or global events, or add per-example
Rspeedy builds.

For generated XML, consume `done.preview.sourceUrl` from the server, persist it
with the assistant turn, and use it for Web-share and native LynxExplorer links.
Keep the current Web preview on the in-memory final source.

### Template Examples

Import examples as raw editor source. Keep `<template>`, styles, and an authored
`<script thread="main">` together in the XML; the script owns lifecycle and
interaction logic. Convert with `compileLynxXmlFragment` from
`@lynx-js/genui/lynx-xml` at preview runtime, never during the build.

Show editable Original and read-only Transformed views. Template list URLs use
`exampleId` to load and convert the registered example. Preserve the last valid
preview on conversion errors. Never send an intermediate `<template>` to Lynx
or expose its source file as a runnable native artifact.

### Element Layout

Append the first business node directly to Page, without a generic `app`
wrapper. Keep Page visually unstyled; the business node owns viewport sizing,
background, and entry layout. For overflowing content, make that node a
vertical scroll view. Explicitly set `display: flex` and the intended
`flex-direction` in every layout container's class.

## ReactWeb

ReactWeb exposes Create and Web preview/share. Keep the hook-free adapter in
`src/pages/chat/reactweb.ts` and stream from `/reactweb/stream`. Display source
deltas, but preview only the completed published artifact. Persist both source
files and `artifact.webUrl` with the assistant turn; omit artifact metadata from
follow-up model history.

Use `render.html?protocol=reactweb&sourceUrl=<artifact.webUrl>` for current,
historical, and shared previews. Fetch the bounded document without credentials
in the outer renderer, then use `HtmlView` with `sandbox="allow-scripts"`.
The TOS bucket must allow public reads and CORS from the Playground origin.
Keep Web URLs on the current Playground host. This protocol has no Lynx runtime,
native output, or Bench adapter. See
[ReactWeb instructions](../../../.github/genui-reactweb.instructions.md).

## HTML

### Create and Preview

HTML exposes Create and the shared Bench tab, with no Examples, Catalog, or
native preview. Keep the hook-free adapter in `src/pages/chat/html.ts` and
stream from `/html/stream`. Show partials beginning with the HTML doctype in
the source viewer, but send only complete documents to preview.

Use `extractHtmlArtifact` and `isCompleteHtmlArtifact` from
`@lynx-js/genui-html` for streaming and history restoration. Keep document
parsing in that package and UI/transport behavior in the Playground adapter.

Render through `PreviewViewport` and `HtmlView` using iframe `srcDoc`. Keep
the sandbox at `allow-scripts` without `allow-same-origin`. Do not route HTML
through `render.html`, `<lynx-view>`, protocol bundles, init data, or global props.

### Bench Capture

Use browser-native Element Capture of the sandboxed iframe. Request current-tab
sharing directly from Start run, before asynchronous work, and validate the
selected tab before creating a server job. HTML-only runs need no screenshot
sidecar; mixed runs still require it for Lynx protocols. Serialize captures on
the shared track, send only restricted pixels through the existing BMP
transport, and release tracks and frames on every terminal path.

## Development and Validation

Run commands from the repository root. Follow the root `AGENTS.md` build order:
install frozen dependencies when they may be stale, then run the full Turbo
build before tests. Package-local builds do not replace this validation.

```bash
# Dependencies, when stale
pnpm install --frozen-lockfile

# Full build, required before tests
pnpm turbo build

# Development servers (choose Web or Lynx)
pnpm --filter genui-playground dev
pnpm --filter genui-playground dev:lynx

# Preview existing build outputs
pnpm --filter genui-playground preview
pnpm --filter genui-playground preview:lynx

# Package tests
pnpm --filter genui-playground test
```
