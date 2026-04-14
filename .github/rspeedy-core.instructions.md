---
applyTo: "packages/rspeedy/core/test/**/*"
---

Some rspeedy core test fixtures intentionally keep git-tracked files under fixture `node_modules` directories. When cleaning caches or build outputs, avoid deleting tracked fixture files under `packages/rspeedy/core/test/**/node_modules`; only remove untracked/generated artifacts.
