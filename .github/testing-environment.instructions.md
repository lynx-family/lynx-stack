---
applyTo: "packages/testing-library/testing-environment/**"
---

For computed-style tests, mount the Lynx element in a page before reading its styles. jsdom 31 returns an empty computed style for disconnected elements.

Keep DOM libraries explicit in this package's API Extractor compiler configuration: its public declarations reference `Node` and `Window`, while the shared Node.js tsconfig does not include DOM types. Verify toolchain upgrades with the workspace-pinned API Extractor rather than relying on a different downstream version.
