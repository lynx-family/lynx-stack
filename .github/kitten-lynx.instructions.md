---
applyTo: "packages/testing-library/kitten-lynx/**/*"
---

For Kitten Lynx Android E2E fixtures, build Lynx bundles with `rspeedy build` into an ignored generated directory and serve those static outputs from the test process. Avoid using `rspeedy dev` as the test server because the emulator/devtool bridge is sensitive to dev-server lifecycle and transport timing.
