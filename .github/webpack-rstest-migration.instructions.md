---
applyTo: "packages/webpack/**/*"
---

When migrating webpack package tests from Vitest to Rstest, define `setupFiles` in `rstest.config.ts` via `createRequire(import.meta.url).resolve(...)` instead of bare package subpaths to avoid module resolution issues.
When migrating webpack package config cases from `test/**/cases/**` to `test/**/configCases/**`, keep root ESLint ignores aligned so config-case fixtures continue to be treated like other harness-owned case files instead of suddenly failing generic `no-undef` and `import/no-unresolved` rules.
For ESM case config files (`*.config.js` under package tests), prefer explicit ESM-safe imports (for example `../../../../lib/index.js`) and use `createRequire(import.meta.url)` plus `new URL('.', import.meta.url).pathname` when `require.resolve` or `__dirname` behavior is needed.
If hot-snapshot cases report incomplete update steps after migration, run targeted snapshot refresh with `rstest -u` on the specific `HotSnapshot.test` filter before broad reruns.
When shared `@lynx-js/test-tools` helpers are migrated to read test APIs from `globalThis`, keep `globals: true` in Vitest configs for still-Vitest suites that consume those helpers (for example webpack react/css-extract plugin suites).
In template-webpack-plugin rstest coverage, keep `context` anchored to the test directory but use a relative webpack entry (`'./fixtures/basic.tsx'`) to avoid erroneous rewrites to unresolved `/static/assets/*.tsx` module paths.
