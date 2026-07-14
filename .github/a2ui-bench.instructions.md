---
applyTo: "packages/genui/server/service/a2ui-bench-*.ts,packages/genui/server/app/a2ui/bench/**,packages/genui/playground/src/pages/BenchPage.tsx,packages/genui/server/next.config.mjs"
---

A2UI bench jobs that enable render metrics should render generated messages through the playground `render.html` URL supplied by the client or `A2UI_BENCH_PLAYGROUND_BASE_URL`. Surface browser, screenshot, and preview-render failures in the item errors so reports explain missing metrics.

The A2UI server uses Playwright and Chromium to render previews. Keep `@sparticuz/chromium` and `playwright-core` in `serverExternalPackages` so Turbopack does not bundle those server-only dependencies.

Bench job event streams can sit in a long-running phase without producing run events. Keep the `/a2ui/bench/jobs/[jobId]/events` SSE response alive with heartbeat comments, and let native EventSource disconnects reconnect unless the server sends an explicit `event: error` payload. Otherwise proxies or serverless hosts may close an idle stream and the playground will lose a still-running job.

Local A2UI bench runs with render metrics need a usable Chromium runtime for preview capture. Either install the Playwright browser cache or start the server with `CHROME_EXECUTABLE_PATH` or `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. If preview rendering fails, the report will show zero render metrics with a browser launch error.
