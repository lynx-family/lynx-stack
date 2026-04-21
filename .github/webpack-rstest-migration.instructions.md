---
applyTo: "packages/webpack/**/*"
---

When migrating webpack package tests from Vitest to Rstest, define `setupFiles` in `rstest.config.ts` via `createRequire(import.meta.url).resolve(...)` instead of bare package subpaths to avoid module resolution issues.
For ESM case config files (`*.config.js` under package tests), prefer explicit ESM-safe imports (for example `../../../../lib/index.js`) and use `createRequire(import.meta.url)` plus `new URL('.', import.meta.url).pathname` when `require.resolve` or `__dirname` behavior is needed.
If hot-snapshot cases report incomplete update steps after migration, run targeted snapshot refresh with `rstest -u` on the specific `HotSnapshot.test` filter before broad reruns.
