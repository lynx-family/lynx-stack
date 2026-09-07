---
applyTo: "packages/genui/server/service/a2ui-bench-*.ts,packages/genui/server/app/a2ui/bench/**,packages/genui/playground/src/pages/bench/**,packages/genui/server/rslib.config.ts"
---

A2UI bench jobs run agent generation and validation in `genui-server`, but browser-backed render metrics and screenshots remain disabled. Keep browser metrics marked as disabled in reports.

Let every comparison group select its model independently, but expose and accept only public model names returned by the GenUI server. Do not add a free-form Bench model input or reinterpret an unknown group model as an upstream model ID.

UI Judge scoring may use only the independent Rust HTTP sidecar. Configure its default location with the private server environment variable `UI_JUDGE_SERVER_URL`, allow a Bench job to provide a normalized credential-free HTTP(S) `playground.uiJudgeServerUrl`, and optionally set the server-owned `UI_JUDGE_BUNDLE_URL` for the `a2ui.lynx.js` bundle. Probe `GET /health` before a job and derive the report's Judge capability only from readiness; the Judge model is sidecar-owned and must not be configured or validated by GenUI Server Bench. Send successful generated messages to `POST /judge` only as server-owned Lynx init data or global props; never accept the bundle URL or injected props from the Bench client.

Treat UI Judge scoring as atomic at the Bench boundary. Any visual-score, GEQI dimension, aggregate-contract, request, or response error must set both the judge and the containing run to failed, force the persisted judge score to zero, omit partial dimension and GEQI aggregates, and exclude the run from Judge averages. Apply this consistently to native A2UI and protocol-adapter A2UI/OpenUI paths; keep screenshots and error messages only as failure diagnostics.

Never let model-generated Bench messages make the server-side headless renderer load resources. Remove `openUrl` from every Bench prompt catalog, replace `Image`, `LazyComponent`, `LineChart`, `McpApp`, and `PieChart` definitions with inert placeholders, downgrade Markdown `Text`, and reject recursive `openUrl` function calls before calling UI Judge. The headless resource callback can otherwise read `file://` paths, access arbitrary HTTP endpoints, load executable nested bundles, or block its single capture worker on an unbounded download.

Do not add `@sparticuz/chromium` or `playwright-core` back to `packages/genui/server`. Keep the entire browser-backed implementation in `a2ui-bench-preview.ts` and its runner import and call sites commented until preview rendering moves to its dedicated service. Do not add a fallback preview implementation, capability flag, or configuration switch while it is disabled.

Bench job event streams can sit in a long-running phase without producing run events. Keep the `/a2ui/bench/jobs/[jobId]/events` SSE response alive with heartbeat comments, and let native EventSource disconnects reconnect unless the server sends an explicit `event: error` payload. Otherwise proxies or serverless hosts may close an idle stream and the playground will lose a still-running job.
