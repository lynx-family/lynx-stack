---
applyTo: "packages/genui/server/service/a2ui-bench-*.ts,packages/genui/a2ui-playground/src/pages/BenchPage.tsx,packages/genui/server/next.config.mjs"
---

A2UI bench jobs that enable UI judge should render generated messages through the playground `render.html` URL supplied by the client or `A2UI_BENCH_PLAYGROUND_BASE_URL`, then run `@lynx-js/ui-judge` against that browser page. Do not mark judge or render metrics as skipped when their settings are enabled; surface browser, model, or preview-render configuration failures in the item errors so reports explain missing scores.

When importing Midscene or UI judge from the Next server, keep `@lynx-js/ui-judge`, `@midscene/core`, `@midscene/shared`, `@midscene/web`, `@sparticuz/chromium`, and `playwright-core` in `serverExternalPackages` so Turbopack does not bundle optional Midscene debug integrations.
