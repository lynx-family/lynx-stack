---
applyTo: "packages/web-platform/**/{rstest.config.ts,*.test.ts,*.spec.ts,package.json}"
---

When migrating or adding web-platform unit/server tests under Rstest, import test APIs from `@rstest/core` and use `rstest.fn`, `rstest.spyOn`, `rstest.mock`, `rstest.mocked`, and `rstest.mockObject` as the Vitest `vi` equivalents. Keep benchmark files on Vitest (`vitest bench`) unless Rstest adds benchmark support; do not include `*.bench.*` files in Rstest configs.

If a web-platform Rstest suite uses `new URL(..., import.meta.url)` to address worker scripts or fixtures on disk, keep Rspack URL parsing disabled with `tools.rspack.module.parser.javascript.url = false` so the path remains a real filesystem URL at runtime.
