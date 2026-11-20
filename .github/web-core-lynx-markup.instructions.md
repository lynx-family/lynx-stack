---
applyTo: "{packages/lynx-xml/parser/**,packages/web-platform/web-core/{ts/encode/xmlToTasmJSON.ts,tests/xml-to-web-bundle.spec.ts,tests/template-manager.spec.ts}}"
---

Publish `packages/lynx-xml` as `@lynx-js/lynx-xml`. Keep the parser and its grammar tests in the `parser/` directory and import it through `@lynx-js/lynx-xml/parser` in Web Core. Keep the single-file Lynx XML boundary on the current Vanilla Lynx syntax: lowercase `<!doctype lynx>` when a doctype is present, a `<lynx engine-version="...">` root, optional raw `<style>` content, a required `<script thread="main">`, and an optional `<script thread="background">`. Do not accept the legacy `version`, `main-thread`, `background`, XML declaration, uppercase doctype, or CDATA spellings. Keep parser tests and markup fixtures on the current syntax and add explicit rejection coverage before changing this boundary.

When encoding a Lynx XML card for Web, always register the fixed `/app-service.js` manifest entry expected by Lynx Core. Preserve an explicit background script verbatim; when the optional background block is absent, synthesize an empty chunk instead of omitting the entry and allowing a network fallback.
