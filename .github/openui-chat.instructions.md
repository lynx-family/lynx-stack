---
applyTo: "packages/genui/openui/src/chat/**,packages/genui/openui/test/chat*,packages/genui/playground/**/*openui*"
---

OpenUI Chat uses a separate vocabulary from the default Lynx Stack catalog. In particular, Card takes children and sources, and Text starts with a variant before its value. Keep Chat schemas under src/chat with headless definition.ts modules reused by the renderer and chat/agent entry. Do not replace the existing catalog's positional contracts to add Chat support. Match a scenario's validation library to its rendering library and keep the Library instance stable across renders.

Track upstream schema provenance in openui/THIRD_PARTY_NOTICES.md. Document supported components explicitly; a Chat-compatible subset does not imply support for every component in the official library. ProductFeature is a document extension, not an upstream component.
