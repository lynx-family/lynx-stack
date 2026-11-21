---
applyTo: "packages/islands/**"
---

Model the public API as exposed modules and isolated container instances. Keep build integration in `/build`, native loading and instance creation in `/runtime`, ReactLynx worklet integration in `/react`, and shared native section naming in `/shared`.

`pluginIslands` accepts an `exposes` map. Inline and remote output must use identical section names. The main-thread wrapper supplies the lexical `__lynxIsland` marker. Every exposed main script exports a module with `create()`, and every call must return fresh `render`, `update`, `dispose`, and optional `setBackgroundReady` state. Never store container-specific native handles in module scope.

Keep delivery and rendering entry separate. `inline` includes sections in the host bundle; `remote` emits a separate bundle loaded by URL. Both render hosted UI. `hosted` means the existing host owns the Page and container; `standalone` is an optional page entry provided by a source. Neither rendering-entry term belongs in IslandReference or Island props. These are local design terms, not a requirement of islands architecture or the SDK's EmbeddedMode feature.

Keep module loading independent from instance creation. Loading evaluates the exposed section, adopts its page-scoped stylesheet, and starts background initialization. Creating an instance owns pending props, cancellation, native nodes, listeners, and disposal. One loaded module must support concurrent instances in different containers.

Keep main readiness independent of background readiness. Fetch remote bundles separately on each thread and use the resolved URL as bundle identity. Use `__Card__` for inline sections. Cache background initialization by entry and expose, clearing failures for retries. Subscribe to readiness before dispatching and remove temporary listeners when settled or destroyed. Native handles, loaded modules, instances, and readiness promises stay on their owning threads.

Use the shared `@lynx-js/lynx-xml/parser` result for exposed source parsing. Keep XML grammar and offset diagnostics in that package; convert its raw CSS in the Islands build layer with the existing CSS serializer. Reject unsupported at-rules and unresolved stylesheet imports before serialization, preserve optional empty sections, and avoid coupling this native build path to `web-core/encode`.

Inline references render synchronously from the main-thread container ref, using initial serializable props; do not put a Promise continuation or background effect in that initial node-creation path. Retain the module and instance inside MainThreadRef so hydration reuses them. Queue background preparation/status calls through ReactLynx's runOnBackground hydration mechanism. Keep remote references asynchronous. Test compiled worklet hydration as well as synchronous ref timing; the compiler dependency belongs only in devDependencies.

Callback refs can detach and reattach during hydration. Preserve an inline instance when the same native container receives the new ref: identify the container with its private owner attribute and defer final detached cleanup until the current synchronous ref handoff has finished. A different native container must dispose the previous renderer immediately. Keep a compiled-worklet regression test that exercises detach, context hydration, reattach, and delayed background activation.
