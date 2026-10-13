---
applyTo: "packages/genui/openui/src/chat/**,packages/genui/openui/test/chat*,packages/genui/playground/**/*openui*,packages/genui/openui/rstest.config.ts,rstest.config.ts,.github/workflows/test.yml"
---

OpenUI Chat uses a separate vocabulary from the default Lynx Stack catalog. In particular, Card takes children and sources, and Text starts with a variant before its value. Keep Chat schemas under src/chat with headless definition.ts modules reused by the renderer and chat/agent entry. Do not replace the existing catalog's positional contracts to add Chat support. Match a scenario's validation library to its rendering library and keep the Library instance stable across renders.

When extending withDefaultConfig, append compiler plugins to config.plugins instead of replacing them. The testing library's default plugins route the worklet-runtime init entry through the emulated main thread; dropping them can overwrite test timers during runtime initialization.

Markdown tables and the Chat Table component have independent renderers. Validate both paths when fixing table layout: a horizontal scroll-view needs a single vertical content view with a shared row width. Check row and column geometry on narrow and wide viewports; parser and text-content assertions do not verify layout.

Track upstream schema provenance in openui/THIRD_PARTY_NOTICES.md. Document supported components explicitly; a Chat-compatible subset does not imply support for every component in the official library. ProductFeature is a document extension, not an upstream component.

Do not share a mutable Zod object between different component names: lang-core associates each object with a schema ID, so use a fresh object (for example Text.props.extend({}) for BoldText). Keep renderer keys based on statement IDs or stable field names rather than values or random numbers. Interactive tests need pluginReactLynx in the Rstest configuration; plain JSX transforms can render text without installing Lynx event bindings.

Keep form field values in the response store using resolveStateField, and resolve shared bindings again inside events before merging updates. Checkbox groups may share one object and even a field name; preserve keys belonging to sibling groups, validate only the current group's items, and register each mounted group under a unique validation key. Defaults must not overwrite hydrated or edited values. Preserve the upstream array-valued Slider contract when adapting the single-value Lynx UI slider.

Playground Chat examples must pass openuiLibrary through editor parsing, render URLs, published-payload previews and native QR links. Do not infer the catalog from a component name: existing Stack examples can also use Card roots. Keep large example sources as copied .openui files and use rawTextUrl for list previews. Resolve the packaged demo image/reference URLs on the host before rendering; never change arbitrary user URLs.

Carry the selected OpenUI library into native screenshot globalProps as well as Web and QR URLs. Preserve initialQueryResults and data-tool initialization when combining Chat catalog selection with inline, live, and rawTextUrl inputs; restored false, zero, null, and empty arrays are valid Query values.

Keep the Marked lexer behind the compile-time `__BACKGROUND__` guard: its Unicode property escapes do not compile in the native main-thread VM. Retain a text-only first-frame fallback and validate Chat integration with both Web and native bundle builds, not only Node-based parser tests.

Run the OpenUI Rstest project separately from the repository's aggregate Rstest command, as configured in the Linux and Windows CI jobs. pluginReactLynx changes shared bundler transforms and aliases across the aggregate build; passing package-local tests does not establish compatibility with other test projects. Keep the dedicated command in CI when modifying the root project list. Explicitly annotate exported context values with Context from @lynx-js/react so emitted declarations do not introduce React DOM imports.
