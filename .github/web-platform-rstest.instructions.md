---
applyTo: "packages/web-platform/**/{rstest.config.ts,*.test.ts,*.spec.ts,package.json}"
---

When migrating or adding web-platform unit/server tests under Rstest, import test APIs from `@rstest/core` and use `rstest.fn`, `rstest.spyOn`, `rstest.mock`, `rstest.mocked`, and `rstest.mockObject` as the Vitest `vi` equivalents. Rstest has no benchmark API, so benchmarks use [tinybench](https://github.com/tinylibs/tinybench) (with `@codspeed/tinybench-plugin` for CodSpeed); keep `*.bench.*` files out of the ordinary Rstest test configs.

If a web-platform Rstest suite uses `new URL(..., import.meta.url)` to address worker scripts or fixtures on disk, keep Rspack URL parsing disabled with `tools.rspack.module.parser.javascript.url = false` so the path remains a real filesystem URL at runtime.
