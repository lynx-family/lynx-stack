---
applyTo: "packages/genui/openui/src/chat/**,packages/genui/openui/test/chat*,packages/genui/playground/**/*openui*"
---

OpenUI Chat uses a separate vocabulary from the default Lynx Stack catalog. In particular, Card takes children and sources, and Text starts with a variant before its value. Keep Chat schemas under src/chat with headless definition.ts modules reused by the renderer and chat/agent entry. Do not replace the existing catalog's positional contracts to add Chat support. Match a scenario's validation library to its rendering library and keep the Library instance stable across renders.

When extending withDefaultConfig, append compiler plugins to config.plugins instead of replacing them. The testing library's default plugins route the worklet-runtime init entry through the emulated main thread; dropping them can overwrite test timers during runtime initialization.

Markdown tables and the Chat Table component have independent renderers. Validate both paths when fixing table layout: a horizontal scroll-view needs a single vertical content view with a shared row width. Check row and column geometry on narrow and wide viewports; parser and text-content assertions do not verify layout.

Track upstream schema provenance in openui/THIRD_PARTY_NOTICES.md. Document supported components explicitly; a Chat-compatible subset does not imply support for every component in the official library. ProductFeature is a document extension, not an upstream component.

Do not share a mutable Zod object between different component names: lang-core associates each object with a schema ID, so use a fresh object (for example Text.props.extend({}) for BoldText). Keep renderer keys based on statement IDs or stable field names rather than values or random numbers. Interactive tests need pluginReactLynx in the Rstest configuration; plain JSX transforms can render text without installing Lynx event bindings.
