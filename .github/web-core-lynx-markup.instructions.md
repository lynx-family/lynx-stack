---
applyTo: "packages/web-platform/web-core/ts/common/xml/**,packages/web-platform/web-core/tests/parseLynxXML.spec.ts,packages/web-platform/web-core/tests/fixtures/*.xml"
---

Keep the Web Core single-file Lynx XML boundary on the current Vanilla Lynx syntax: lowercase `<!doctype lynx>` when a doctype is present, a `<lynx engine-version="...">` root, optional raw `<style>` content, a required `<script thread="main">`, and an optional `<script thread="background">`. Do not accept the legacy `version`, `main-thread`, `background`, XML declaration, uppercase doctype, or CDATA spellings. Keep parser tests and markup fixtures on the current syntax and add explicit rejection coverage before changing this boundary.
