---
"@lynx-js/islands": minor
---

Build exposed island modules into an independent remote bundle with Rsbuild,
without ReactLynx or an application entry. Add an optional entry URL to the
existing Island component while preserving inline first-frame rendering.
Remote loading uses the same module factory and lifecycle, coalesces pending
props, and cancels stale rendering after unmounting or switching resources.
