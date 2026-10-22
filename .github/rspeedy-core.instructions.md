---
applyTo: "packages/rspeedy/core/test/**/*"
---

Some rspeedy core test fixtures intentionally keep git-tracked files under fixture `node_modules` directories. When cleaning caches or build outputs, avoid deleting tracked fixture files under `packages/rspeedy/core/test/**/node_modules`; only remove untracked/generated artifacts.

Rspeedy core uses Rstest for plugin coverage. When a module is not executed by any Vitest project, exclude that exact module from Vitest coverage so Codecov does not merge an unexecuted V8 report with Rstest's lcov report.
