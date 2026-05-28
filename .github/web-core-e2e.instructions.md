---
applyTo: "packages/web-platform/web-core-e2e/**/*"
---

When adding ReactLynx web-core-e2e cases that validate custom font faces, do not change `packages/web-platform/web-core/ts/client/decodeWorker/cssLoader.ts`; ReactLynx e2e fixtures are built into the binary template path by default. Keep `@font-face` declarations in the fixture CSS, and set font-related CSS properties directly on the `<text>` element so screenshot assertions cover text element font application instead of inherited wrapper styles.
