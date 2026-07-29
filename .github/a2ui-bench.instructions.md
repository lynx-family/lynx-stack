---
applyTo: "packages/genui/server/service/a2ui-bench-*.ts,packages/genui/server/app/a2ui/bench/**,packages/genui/playground/src/pages/BenchPage.tsx,packages/genui/server/rslib.config.ts"
---

A2UI bench jobs run agent generation and validation in `genui-server`, but browser-backed render metrics and screenshots remain disabled. Keep browser metrics marked as disabled in reports.

UI Judge scoring may use only the independent Rust HTTP sidecar. Configure it with the private server environment variable `UI_JUDGE_SERVER_URL` and optionally set the server-owned `UI_JUDGE_BUNDLE_URL` for the `a2ui.lynx.js` bundle. Probe `GET /health` before a job and derive the report's Judge capability from that result. Send successful generated messages to `POST /judge` only as server-owned Lynx init data or global props; never accept the sidecar URL, bundle URL, or injected props from the Bench client.

Never let model-generated Bench messages make the server-side headless renderer load resources. Remove `openUrl` from every Bench prompt catalog, replace `Image`, `LazyComponent`, `LineChart`, `McpApp`, and `PieChart` definitions with inert placeholders, downgrade Markdown `Text`, and reject recursive `openUrl` function calls before calling UI Judge. The headless resource callback can otherwise read `file://` paths, access arbitrary HTTP endpoints, load executable nested bundles, or block its single capture worker on an unbounded download.

Do not add `@sparticuz/chromium` or `playwright-core` back to `packages/genui/server`. Keep the entire browser-backed implementation in `a2ui-bench-preview.ts` and its runner import and call sites commented until preview rendering moves to its dedicated service. Do not add a fallback preview implementation, capability flag, or configuration switch while it is disabled.

Bench job event streams can sit in a long-running phase without producing run events. Keep the `/a2ui/bench/jobs/[jobId]/events` SSE response alive with heartbeat comments, and let native EventSource disconnects reconnect unless the server sends an explicit `event: error` payload. Otherwise proxies or serverless hosts may close an idle stream and the playground will lose a still-running job.
