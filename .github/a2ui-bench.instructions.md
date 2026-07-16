---
applyTo: "packages/genui/server/service/a2ui-bench-*.ts,packages/genui/server/app/a2ui/bench/**,packages/genui/playground/src/pages/BenchPage.tsx,packages/genui/server/next.config.mjs"
---

A2UI bench jobs still run agent generation and validation in `genui-server`, but browser-backed render metrics and screenshots are disabled while that capability is split into a browser-capable service. Keep requested browser metrics marked as disabled in reports and surface a deterministic skipped-preview item error so zero metrics are not mistaken for successful measurements.

Do not add `@sparticuz/chromium` or `playwright-core` back to `packages/genui/server`. Keep the disabled Playwright import in `a2ui-bench-preview.ts` as the extraction boundary until preview rendering moves to its dedicated service.

Bench job event streams can sit in a long-running phase without producing run events. Keep the `/a2ui/bench/jobs/[jobId]/events` SSE response alive with heartbeat comments, and let native EventSource disconnects reconnect unless the server sends an explicit `event: error` payload. Otherwise proxies or serverless hosts may close an idle stream and the playground will lose a still-running job.
