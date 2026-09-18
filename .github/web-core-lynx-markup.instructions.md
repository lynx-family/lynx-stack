---
applyTo: "packages/web-platform/web-core/{ts/common/xml/**,ts/encode/xmlToTasmJSON.ts,tests/parseLynxXML.spec.ts,tests/xml-to-web-bundle.spec.ts,tests/template-manager.spec.ts,tests/fixtures/*.xml}"
---

Keep the Web Core single-file Lynx XML boundary on the current Vanilla Lynx syntax: lowercase `<!doctype lynx>` when a doctype is present, a `<lynx engine-version="...">` root, optional raw `<style>` content, a required `<script thread="main">`, and an optional `<script thread="background">`. Do not accept the legacy `version`, `main-thread`, `background`, XML declaration, uppercase doctype, or CDATA spellings. Keep parser tests and markup fixtures on the current syntax and add explicit rejection coverage before changing this boundary.

When encoding a Lynx XML card for Web, always register the fixed `/app-service.js` manifest entry expected by Lynx Core. Preserve an explicit background script verbatim; when the optional background block is absent, synthesize an empty chunk instead of omitting the entry and allowing a network fallback.
