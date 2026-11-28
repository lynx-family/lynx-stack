---
applyTo: "examples/islands-inline/**"
---

Business integration uses only pluginIslands from @lynx-js/islands/build and Island from @lynx-js/islands/react. Register the XML path as an exposes string and render the component by name with props and className. Do not require application code to import the parser, runtime types or internal hooks, provide a container ID, or observe background readiness.

Always include Island sections in the host bundle and write the Island example to dist/inline. Do not configure XML_ISLAND_DELIVERY, an entry URL or a remote output bundle. Keep the optional frame comparison and its separate output directories.

Export a `create()` module factory from the XML main script. Each call owns fresh native nodes, revisions, result listeners, teardown subscriptions, and data snapshots; it returns `render(containerSelector, props, options?)`, `update(props)`, `dispose()`, and `setBackgroundReady()`. Verify two instances can render, update, and dispose independently. Keep native handles inside the factory. Use the lexical `__lynxIsland` marker to skip the standalone `__RenderPage` listener when loaded by a host. Reuse `__GetPageElement()`; creating a second page root corrupts the host tree.

React owns the stable empty container, and XML owns its children. Resolve the container beneath the existing page, use container-relative dimensions, preserve native node identity on updates, and make disposal idempotent. Ref detachment disposes the instance and invalidates pending rendering. Adopted CSS remains page-scoped; disposal does not provide stylesheet isolation.

Hosted XML must reject a missing host Page without creating one. Only the standalone entry may create a Page. Keep the example renderer and its private background commands named `render`, `update`, and `dispose`, matching the lifecycle they implement.

Initialize the example with card data so the Island participates in the first frame without a tap. Preserve buttons for data updates, unmounting and remounting. Verify synchronous node creation before background effects and instance identity after hydration.

Internally load main and background sections through lynx.loadScript with **Card**; use the same bundle identity for the stylesheet. Subscribe to ready/error replies before dispatching. The background helper sends an explicit readiness event because runOnBackground does not await returned Promises. Keep this mechanism out of the application component.

Use paired getJSContext (main) and getCoreContext (background) endpoints for JSON commands/results. Track instance IDs and revisions, cancel background work and delete session state on disposal, and ignore stale replies. Before readiness, coalesce only full props snapshots, initialize the current instance with the latest snapshot, and never resurrect a disposed instance. Background errors must leave successful main rendering usable. Standalone rendering uses probe/ready events to support either script startup order.

Cache background initialization by expose, remove failed entries for retry, and clean up readiness listeners after replies or page destruction. Synchronous resource failures must not leave temporary listeners. Instance listeners and timers are released on disposal.

Include README.md in targeted ESLint checks: its TypeScript fences are parsed as code, so object configuration examples need declarations or expression parentheses.

The XML factory takes no context. `render` defaults to flushing its changes and accepts `{ flush: false }` for the host's synchronous first screen. Honor the same option for repeated render calls without retaining it in the instance. Updates, background replies and disposal flush their own changed nodes. Track displayed text separately from submitted data to skip unchanged native writes. The standalone `__RenderPage` listener passes `{ flush: false }` because native commits afterward; `__UpdatePage` handles later frame.data updates with normal flushing.

Use XML_RENDERER=frame to load the identical raw XML source through frame.src, and copy it alongside the host bundle. Keep the default renderer as island and include XML_RENDERER and XML_BENCHMARK in Turbo env. XML_BENCHMARK suppresses frame status updates; the Island path does not expose readiness status UI. Historical performance captures retain their original metadata and must not be presented as new measurements after source changes.

For the specified synchronous-frame Explorer build, append sync=true to the child frame.src URL via URL.searchParams. XML_FRAME_SYNC defaults to true; false omits the parameter. Use separate dist/frame-sync and dist/frame outputs, and include XML_FRAME_SYNC in Turbo env. Re-record both inline and frame on the same APK when switching native packages; do not calculate performance deltas across APKs. Verify the actual child session URL and request log rather than assuming a parent URL parameter enables synchronous loading.

Keep the offline performance HTML grounded in the recorded trace evidence. Normalize raw trace timestamps consistently within each file, identify their origin separately from PerformanceEntry metrics, and retain event IDs, file hashes, and original instance metadata. Show background preparation as a parallel branch. Check ancestor chains before describing repeated flushes: a frame child update can be nested in a parent flush, so occurrence counts are not additive serial work.

For original-trace embedding, use the verified Lynx Trace Viewer iframe postMessage protocol with explicit target origin, source/origin-checked PONG, bounded handshake timers and cleanup on sample replacement. PONG means the viewer accepts messages, not that parsing succeeded. Preserve raw trace bytes and validate against their recorded hashes. Keep localOnly enabled, retain local downloads when the viewer is unreachable, and distinguish offline summaries from the network-dependent viewer. Viewport postMessage values are absolute trace seconds; route visStart/visEnd are nanoseconds. The report server should bind to loopback and serve only explicit report files.

Record first-frame timing separately from memory traces and forced GC. Compare global Lynx-attributed bytes using complete Memory.getAllMemoryUsage snapshots, preserving collection quality, instance identity, runtime-group deduplication, and the distinction from process PSS. A zero View field without detail does not establish zero native UI cost. Measure local disposal, remounting and full-page exit separately; disappearance from the DOM does not prove immediate resource reclamation.

Preserve the memory-analysis tool's warnings and complete generated HTML when embedding its results. A requested force-GC option or observed RunGC event does not replace a missing trace configuration marker or missing VM counter coverage. Keep conclusions limited to the measured lifecycle and confidence; do not infer a leak from PSS or node counts alone.
