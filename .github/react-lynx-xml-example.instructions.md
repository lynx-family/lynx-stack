---
applyTo: "examples/react-lynx-xml/**"
---

Use `pluginIslands` from `@lynx-js/islands/build` with `parse: parseLynxXML` from `@lynx-js/lynx-xml/parser` to expose the XML source, and `Island` from `@lynx-js/islands/react` to render it through React state. Keep each module reference as `{ expose, entry? }`: an omitted entry reads the current host bundle; a remote entry is an absolute URL reachable from the device. Both output modes watch the XML source and emit the same named sections.

Configure example delivery with `XML_ISLAND_DELIVERY=inline|remote`, default to inline when it is omitted, and include it in Turbo's build environment. Show the default command without an environment variable; remote delivery must be an explicit opt-in. Use matching `dist/inline` and `dist/remote` output paths. Delivery does not choose the rendering entry: both bundles are consumed by the ReactLynx host. Use `isHosted` for the XML entry check, and keep standalone preview optional rather than adding a public runtime mode.

Export a `create()` module factory from the XML main script. Each call owns fresh native nodes, revisions, result listeners, teardown subscriptions, and data snapshots; it returns `render(containerSelector, props)`, `update(props)`, `dispose()`, and `setBackgroundReady()`. Verify two instances can render, update, and dispose independently. Keep native handles inside the factory. Use the lexical `__lynxIsland` marker to skip the standalone `__RenderPage` listener when loaded by a host. Reuse `__GetPageElement()`; creating a second page root corrupts the host tree.

React owns the stable empty container, and XML owns its children. Resolve the container beneath the existing page, use container-relative dimensions, preserve native node identity on updates, and make disposal idempotent. Ref detachment disposes the instance and invalidates pending rendering. Adopted CSS remains page-scoped; disposal does not provide stylesheet isolation.

Hosted XML must reject a missing host Page without creating one. Only the standalone entry may create a Page. Keep the example renderer and its private background commands named `render`, `update`, and `dispose`, matching the lifecycle they implement.

Initialize the example with its XML module and initial props present so the default inline build demonstrates first-frame rendering without a tap. Preserve buttons for later updates, disposal, and recreation. Remote delivery still loads asynchronously; a later screenshot alone does not prove first-frame timing. Verify node creation before background effects and instance identity after hydration.

Load main and background sections independently through native `lynx.loadScript`. Inline output uses `__Card__`, including the bundle argument to `__LoadStyleSheet`; remote output calls `lynx.fetchBundle()` separately on each thread and uses its resolved URL. Subscribe to unique ready/error replies before dispatching. `runOnBackground` serializes the immediate return value without awaiting a returned Promise, so the background helper sends an explicit readiness event. Keep loaded modules, native handles, and readiness promises on the main thread.

Use paired getJSContext (main) and getCoreContext (background) endpoints for JSON commands/results. Track instance IDs and revisions, cancel background work and delete session state on disposal, and ignore stale replies. Before readiness, coalesce only full props snapshots, initialize the current instance with the latest snapshot, and never resurrect a disposed instance. Background errors must leave successful main rendering usable. Standalone rendering uses probe/ready events to support either script startup order.

Keep readiness cache keys based on entry and expose, remove failed initialization for retries, and clean up temporary listeners on reply, main resource failure, or page destruction. The cached background dispatcher can remain for the page lifetime while instance listeners and timers are released independently.

Include README.md in targeted ESLint checks: its TypeScript fences are parsed as code, so object configuration examples need declarations or expression parentheses.
