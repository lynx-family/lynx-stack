---
applyTo: "packages/genui/server/service/a2ui-bench-*.ts,packages/genui/server/app/a2ui/bench/**,packages/genui/a2ui-playground/src/pages/BenchPage.tsx,packages/genui/server/next.config.mjs"
---

A2UI bench jobs that enable UI judge should render generated messages through the playground `render.html` URL supplied by the client or `A2UI_BENCH_PLAYGROUND_BASE_URL`, then run `@lynx-js/ui-judge` against that browser page. Do not mark judge or render metrics as skipped when their settings are enabled; surface browser, model, or preview-render configuration failures in the item errors so reports explain missing scores.

When importing Midscene or UI judge from the Next server, keep `@lynx-js/ui-judge`, `@midscene/core`, `@midscene/shared`, `@midscene/web`, `@sparticuz/chromium`, and `playwright-core` in `serverExternalPackages` so Turbopack does not bundle optional Midscene debug integrations.

Bench job event streams can sit in a long agent or judge phase without producing run events. Keep the `/a2ui/bench/jobs/[jobId]/events` SSE response alive with heartbeat comments, and let native EventSource disconnects reconnect unless the server sends an explicit `event: error` payload. Otherwise proxies or serverless hosts may close an idle stream and the playground will lose a still-running job.

Local A2UI bench runs with render metrics or ui-judge enabled need a usable Chromium runtime for `playwright-core`. Either install the Playwright browser cache or start the server with `CHROME_EXECUTABLE_PATH`/`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; if preview rendering fails before judge, the report will show zero render metrics and zero judge score with a browser launch error.
