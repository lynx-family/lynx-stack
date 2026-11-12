---
applyTo: "packages/genui/{a2ui,server,playground}/**"
---

Support only A2UI v1.0. Reject older and versionless protocol envelopes at message and action ingress; do not add version negotiation or legacy data-model/action branches. Expand inline createSurface initialization through the existing component/data handlers, emit `version: "1.0"` on streamed loading placeholders and snapshots, and apply the same source validation to inline components as updateComponents. Reject duplicate creation before expanding its embedded updates.

For v1.0 data models, preserve JSON scalar types and update ancestor containers as well as descendant signals on subtree replacement or null deletion. Snapshot compaction must retain typed containers and collection context. Forward action and function events through onMessage with transport metadata; keep onAction compatible with the existing payload callback.

Resolve remotely invoked renderer functions against an explicitly registered catalog and enforce allowedCallers, defaulting to rendererOnly. Keep functionCallId unchanged in responses. The GenUI service currently has no agent-side catalog functions; return UNKNOWN_FUNCTION without asking a model to simulate execution. Preserve SSE framing for RPC replies on the streaming endpoint.

Catalog generation and serialization use protocolVersion 1.0, $id, and maps of component/function schemas. Put function returnType and allowedCallers outside properties; function calls carry only @call, catalogId, and args. Use the pinned official basic function schemas with local Lynx-compatible implementations. Do not restore the 0.9 Web SDK dependency. Built-in validation functions return ValidationResult objects.

A2UI v1.0 CheckRule.message remains an optional fallback. Prefer ValidationResult.message, then the rule message, then a generic error. Preserve this field in component prop types and generated catalogs; it is not a legacy protocol feature.

Validate completed streaming envelopes with the shared message schema before delivery; final response validation runs too late to protect rendered state. Deleting a surface must clear all validator component, catalog, data-model, and binding-path state before the ID is reused.

Check actual emitted messages and catalogs against pinned official v1.0 schemas. Logical functions must unwrap ValidationResult.valid before boolean operations. Preserve component reference semantics in generated schemas, and never advertise schema-less runtime components as empty schemas. The Lynx JavaScript engine does not support Unicode property escapes in regular expressions; keep interpolation tokenization compatible with the native build.

Migrate raw Playground JSON examples as well as TypeScript-generated demos. Every message must declare `version: "1.0"` and use a registered catalog ID. Display renderer protocol errors through onMessage in the preview; onAction alone leaves rejected streams blank without explaining the failure.

Pin schema fixtures and function sources to an upstream commit. Current 1.0 uses @path and @call for dynamic values, @catalogId/@metadata/@accessibility for component envelopes, and @checks for validation traits. Surface catalogId, function catalogId, collection-template path, and updateDataModel.path remain unprefixed. Never add a dual-read fallback for old keys. Unescape @@ keys exactly once in literal dynamic objects.

Forward every renderer protocol message through onMessage. Surface-independent renderer RPCs use an empty data model; scoped RPCs require an existing surface. Enforce allowedCallers and requiresUserActivation before argument evaluation. Reactive functions may share results, while actions issue fresh calls and await their arguments. Report routed errors by functionCallId and local errors by surfaceId. Validate native bytecode builds when changing schema or expression dependencies: Web-compatible regular expressions are not necessarily accepted by Lynx.

When merging main, migrate new A2UI producers and fixtures to the current wire contract too. The Playground bridge lives in `src/render/a2ui.ts`; preserve protocol messages and metadata there. Jev composition must use `@path`, normalize inline surface initialization when restoring snapshots, and emit only version `1.0`. Keep batch-aware loading placeholders in the stream parser without reintroducing repeated surface creation or old message versions.

Jev action responses must update the live surface without repeating createSurface. When changing public A2UI types or API comments, keep exports and `docs/i18n/zh.json` translations complete so the full docs build passes.

Bundle the argument schema validator with a host-independent base URI. Lynx Web can expose self.location while leaving the sandbox's location global undefined; a dependency that reads location during import can blank the renderer before onMessage is attached. Verify the built schema module in that environment and check a packed consumer in the actual Web runtime, not just Node or source-level tests. Keep the schema bundler configuration in both A2UI and umbrella Turbo inputs.

Treat A2UI messageStore=null as an empty-state boundary that unmounts the rendering session and unsubscribes from the previous store. Mount a fresh session when a store arrives, processing its buffered messages and subsequent updates. Keep hooks in the non-null session component; do not conditionally skip hooks inside a persistent renderer. Direct non-null store replacement still requires a key to reset the session.

Run A2UI rendering tests with pluginReactLynx from the A2UI package directory. Like OpenUI, this project must run separately from the root Rstest aggregate because the compiler changes shared bundler transforms. Keep its standalone coverage command in both Linux and Windows CI jobs when adjusting test discovery.
