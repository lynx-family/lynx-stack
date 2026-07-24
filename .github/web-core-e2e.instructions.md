---
applyTo: "packages/web-platform/web-core-e2e/**/*"
---

When adding ReactLynx web-core-e2e cases that validate custom font faces, do not change `packages/web-platform/web-core/ts/client/decodeWorker/cssLoader.ts`; ReactLynx e2e fixtures are built into the binary template path by default. Keep `@font-face` declarations in the fixture CSS, and set font-related CSS properties directly on the `<text>` element so screenshot assertions cover text element font application instead of inherited wrapper styles.

When testing ReactLynx `bind*` props against Web custom elements, use the developer-facing tag in the fixture and assert the complete ReactLynx event bridge. ReactLynx normalizes a prop such as `bindmessage` to the DOM event name `message`, so a custom element must emit the unprefixed event with `bubbles: true` and `composed: true`; a DOM-only test for a literal `bindmessage` event does not cover that contract.
