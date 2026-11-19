---
applyTo: "packages/testing-library/testing-environment/**"
---

For computed-style tests, mount the Lynx element in a page before reading its styles. jsdom 31 returns an empty computed style for disconnected elements.
