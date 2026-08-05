---
applyTo: "{packages/web-platform/web-core/{ts/client/decodeWorker/**,ts/client/mainthread/elementAPIs/createElementAPI.ts,ts/server/elementAPIs/**,ts/types/IElementPAPI.ts,tests/*lynx-markup*.spec.ts,tests/element-apis.spec.ts,tests/template-manager.spec.ts},examples/lynx-markup-hangzhou/**}"
---

Treat Lynx `.xml` artifacts as HTML-like markup, not strict XML: the thread
selectors are boolean attributes (`<script main-thread>` and
`<script background>`), and the parser must remain usable inside a dedicated
worker without DOM APIs. Preserve section text verbatim, reject duplicate or
unknown top-level sections, and keep the `<!DOCTYPE lynx>` discriminator.

Map markup sections onto the existing decoded-template channels instead of
adding a parallel runtime path: `<style>` to legacy `StyleInfo` content,
main-thread code to `LepusCode.root`, and background code to
`Manifest["/app-service.js"]`. Keep unit coverage for parser failures and an
integration test that verifies all three TemplateManager callbacks.

Treat the browser example's `.xml` file as a zero-build artifact generated
directly by an LLM. Its Rsbuild host only copies the artifact and mounts
`<lynx-view>` with the `.xml` URL; `web-core` parses it at runtime. Do not
describe the XML as compiler output or introduce a ReactLynx or Rspeedy
compilation step for the Lynx page itself.

Bind direct main-thread Element PAPI events with `__AddEventListener` and
remove them with the matching `__RemoveEventListener` arguments. On Web, map
Lynx event names such as `tap` to their DOM source events, pass a normalized
Lynx event object to the callback, and detach every direct listener when the
runtime is disposed. SSR implementations remain no-ops because callbacks only
run after client startup.
