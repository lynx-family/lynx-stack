---
applyTo: "packages/genui/reactweb/**,packages/genui/server/**/reactweb/**,packages/genui/playground/src/**/reactweb.*,packages/genui/playground/src/utils/reactWebPreview*"
---

ReactWeb is the React DOM generation protocol. Keep its prompt, exact two-file
source contract, import policy, and compiler in `@lynx-js/genui-reactweb`.
The server owns the model, shared request capabilities, SSE orchestration, and
TOS publication; the Playground owns rendering and persisted conversation state.

Compile generated source without executing it on the server. Keep compiler
configuration and the React DOM entry point host-owned. Reject extra files and
unsupported module imports before resolution, bound concurrency, queue length,
diagnostics, elapsed time, and artifact size, and remove temporary projects on
every terminal path. The compiler child must not inherit model or TOS credentials.
Keep the package external in the server bundle so its worker and node_modules
remain relative to its own import.meta.url. Cache `dist/**` through Turbo.

Inline React DOM, application JavaScript, and CSS in the published HTML.
Inject scripts at the end of body, after the root mount element: inline scripts
ignore defer and execute immediately during HTML parsing.
In Create, emit a successful final artifact only after publication completes. Preserve model
usage and build/upload timing on errors. Keep follow-up model history free of
artifact metadata while persisting source files and the public URL together.

Download compiled HTML in the outer render.html page with credentials omitted,
enforce the response size limit, and render through the existing HtmlView
allow-scripts sandbox. Keep Web preview URLs on the current Playground host.
Do not route ReactWeb through Lynx bundles, init data, or native previews.

Build the complete repository through Turbo before running tests. Verify real
compiler output and browser React interactions as well as mocked route ordering,
cancellation, publication failures, and history restoration.

ReactWeb Bench uses the native profile without a catalog. Generate the same
App.tsx/App.css source contract with search and image generation disabled,
compile through buildReactWeb, and feed compiler diagnostics into bounded
repair attempts. Keep source JSON as report evidence and compiled HTML as the
Judge payload. Reuse browser/html screenshot tasks and Element Capture with
the existing sandbox and CSP; do not publish Bench builds to TOS or require a
Lynx screenshot sidecar. Preserve cancellation and model usage on compiler
failures, and keep ReactWeb in plan sharing and history normalization.
