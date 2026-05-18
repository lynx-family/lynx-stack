---
applyTo: "packages/web-platform/web-core-e2e/**"
---

The web-core-e2e Playwright server runs Rsbuild dev server in CI. If GitHub Actions fails before tests with `EMFILE: too many open files` from Chokidar while watching `rsbuild.config.ts`, prefer reducing native file watchers for this package, for example by setting `CHOKIDAR_USEPOLLING=1` and a conservative `CHOKIDAR_INTERVAL` before the Playwright webServer starts.
