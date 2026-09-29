---
applyTo: "{packages/solid/**,packages/lynx/element-template-runtime/**,packages/rspeedy/plugin-solid/**,examples/solid/**}"
---

Keep `@lynx-js/element-template-runtime` framework-neutral. It may own serializable protocol values, host descriptors, logical handle/tree state, and background-to-main command transport, but not Solid or React reconciliation, hydration, list, ref, or worklet behavior.

SolidLynx application code uses one source entry. `@lynx-js/solid-rsbuild-plugin` must compile that source for both Vanilla Lynx layers with Solid's DOM transform, then convert each generated static `template()` fragment into one Lynx Element Template definition and a single-argument `createTemplate(templateKey)` call; do not require users to author separate main-thread and background-thread files.

Lower Solid's generated static-node navigation and dynamic helper calls at build time into operations on the template root handle plus Element Template slot indices. Do not expose static template nodes through `firstChild`, `nextSibling`, selectors, parts APIs, or a runtime node plan.

Group reactive attribute and text slot reads for one compiled template instance into one Solid effect. Run the component once on the main thread to produce the first frame, then immediately dispose that Solid owner so it cannot observe later updates. Run the component again on the background thread to establish the long-lived reactive graph, validate that both initial command streams match, and apply only subsequent background slot updates to the existing main-thread handles.

Follow `packages/react-signals/src/mainThread.ts` for main-thread reactive exports: expose immutable initial Signal values, reject setters, avoid subscriptions and user effects, and execute compiler render effects once for first-screen slot initialization.

Main-thread control-flow helpers such as `For` and `Show` must evaluate only the initial state and read lazy JSX property getters exactly once, matching Solid's background-thread creation order. Wrap each background event handler in one Element Template command batch so dynamically created templates receive their initial attribute and raw-text slots before insertion.

Run Solid reconciliation, signals, and normal `bind*` or `catch*` handlers on the background thread. The main thread creates the page root, receives serialized Element Template commits, applies Element PAPI operations, and flushes once per commit.

Use `@lynx-js/lynx-runtime` Engine lifecycle listeners (`__RenderPage`, `__UpdatePage`, and `__DestroyLifetime`) directly. Do not inject or expose ReactLynx-compatible `processData`, `renderPage`, `updatePage`, `__lynxRuntime*`, or `registerDataProcessors` APIs in the Solid integration.

Keep native Element PAPI handles on the main thread. Cross-thread payloads use logical numeric handles and serializable values only.

When a template is created and its attribute slots are updated in the same remote batch, merge those initial values into the `createTemplate` command before dispatch. Native Element Template creation needs initial slot values to render the first frame; later updates remain `setAttribute` commands.

When changing the Solid JSX compiler configuration, assert that final bundles contain no Solid HTML `template()` calls or template HTML strings. Verify that each extracted static JSX fragment becomes one nested `elementTemplate` definition, while its generated DOM helpers remain aligned with the `@lynx-js/solid` runtime export surface.

Compile an unanchored dynamic insertion into an otherwise empty `<text>` as a `raw-text` attribute slot inside the enclosing fragment, and update that slot through the fragment's shared Element Template handle. Do not materialize a separate `_et_builtin_raw_text` child template for this case; reserve child slots and standalone templates for dynamic node structure.
