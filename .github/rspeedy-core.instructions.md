---
applyTo: "packages/rspeedy/core/test/**/*"
---

Some rspeedy core test fixtures intentionally keep git-tracked files under fixture `node_modules` directories. When cleaning caches or build outputs, avoid deleting tracked fixture files under `packages/rspeedy/core/test/**/node_modules`; only remove untracked/generated artifacts.

Rspeedy core uses Rstest for plugin coverage. When a module is not executed by any Vitest project, exclude that exact module from Vitest coverage so Codecov does not merge an unexecuted V8 report with Rstest's lcov report.

Rsbuild 2.3.3 and later include the installed Rsbuild version in the persistent cache version. Use `rsbuildVersion` when asserting the cache key. For config validation errors whose type names contain generated Typia aliases such as `__type.o65`, assert the config path and the rejected value type so upstream type additions do not invalidate the test.
