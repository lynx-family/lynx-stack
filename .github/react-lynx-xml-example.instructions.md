---
applyTo: "examples/react-lynx-xml/**"
---

Lynx XML is a standalone page artifact. When loading it after a ReactLynx page
has rendered, keep its `__RenderPage` listener for standalone use and export an
idempotent `mount()` from the main-thread script for `lynx.loadScript()` callers.
The engine prefers a registered `__RenderPage` listener over the host's global
`renderPage` function. Use the parcel wrapper's lexical `__lynxParcel` marker
to skip registration in embedded execution, including hosts that register
their own engine listener.
In the late-loaded path, reuse `__GetPageElement()` rather than creating a second
page root; the latter corrupts the ReactLynx host's element tree. Resolve an
explicit container selector beneath that root, and append XML content only to
that container. Keep the host container stable and empty in JSX: React owns
the container and the XML script owns its children. Use container-relative
dimensions instead of viewport sizing or an absolute page overlay. Expose `mount(containerSelector, initialData)`, `update(nextData)`, and
`unmount()` on the XML module. Repeated mount on the same container updates data;
changing containers requires unmount. Update patches existing nodes using a full
data snapshot. Unmount is idempotent, releases owned nodes/listeners/references,
and permits remount. Keep the loaded module and loading promise in a main-thread
ref. Ref detachment must unmount and invalidate in-flight mounts. Adopted CSS
remains page-scoped; lifecycle cleanup must not imply stylesheet isolation.
Support embedded and external XML delivery with the same namespaced sections.
Embedded mode appends sections through LynxTemplatePlugin.beforeEncode without
replacing the host scripts, manifest or CSS. External mode emits a separate
bundle and calls `lynx.fetchBundle()` before `lynx.loadScript()`. Scripts and
styles must be named custom sections; load the CSS with `__LoadStyleSheet` and
`__AdoptStyleSheet` on the main thread. Native custom main-thread scripts need the
CommonJS return wrapper used by `MainThreadRuntimeWrapperWebpackPlugin`; keep the
XML body itself as the source of truth. In external mode, publish the XML bundle at an absolute URL
reachable from the device. Both modes must watch the `.lynxml` source for rebuilds.
Keep source configuration discriminated by kind; embedded sources need no URL.
Cache background initialization by both bundle identity and section prefix.

Use `@lynx-js/parcels` for artifact packaging and loading. Render the compiled XML with the shared `ParcelView` component in App.tsx and drive it through React state. Load XML background source as its own section on the
background thread asynchronously, without gating main-thread script execution or
mounting. Use paired getJSContext (main) and
getCoreContext (background) endpoints for JSON commands/results. Track instance
IDs and revisions, cancel background work and delete per-mount state on unmount,
and ignore late results. Do not send native node handles or loaded exports
across threads. A page-scoped dispatcher may remain for the cached module while
all per-mount listeners and timers must be cleaned up.

Native loaders use `__Card__` to select current-host sections (an empty string is
not equivalent), including the required bundle argument to __LoadStyleSheet.
runOnBackground serializes the immediate return value and does not await a
returned Promise. For async background initialization, subscribe to a unique
ready/error event before dispatching, send a serializable reply on completion,
and remove the temporary listener on reply, main resource failure or page destruction.
Return main readiness separately from background readiness. Keep background errors
observable without rejecting a successful main load or removing local UI. Before
background readiness, coalesce only full data snapshots and initialize the current
session with the latest revision when ready. Clear pending snapshots on unmount;
late readiness must not create a session for an unmounted instance. Do not apply
snapshot coalescing to imperative actions. Standalone XML must handshake through
probe/ready events so either script execution order can render before background
startup. Loaded exports, readiness promises and node handles remain on the main thread.

Include README.md in targeted ESLint checks: its TypeScript fences are parsed as
code, so object configuration examples need declarations or expression parentheses.
