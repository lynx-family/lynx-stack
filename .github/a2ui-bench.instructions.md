---
applyTo: "packages/genui/server/service/a2ui-bench-*.ts,packages/genui/server/app/a2ui/bench/**,packages/genui/playground/src/pages/BenchPage.tsx,packages/genui/server/rslib.config.ts"
---

A2UI bench jobs still run agent generation and validation in `genui-server`, but browser-backed render metrics and screenshots are disabled while that capability is split into a browser-capable service. Keep browser metrics marked as disabled in reports.

Do not add `@sparticuz/chromium` or `playwright-core` back to `packages/genui/server`. Keep the entire browser-backed implementation in `a2ui-bench-preview.ts` and its runner import and call sites commented until preview rendering moves to its dedicated service. Do not add a fallback preview implementation, capability flag, or configuration switch while it is disabled.

Bench job event streams can sit in a long-running phase without producing run events. Keep the `/a2ui/bench/jobs/[jobId]/events` SSE response alive with heartbeat comments, and let native EventSource disconnects reconnect unless the server sends an explicit `event: error` payload. Otherwise proxies or serverless hosts may close an idle stream and the playground will lose a still-running job.
