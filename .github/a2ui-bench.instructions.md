---
applyTo: "packages/genui/server/service/a2ui-bench-*.ts,packages/genui/server/app/a2ui/bench/**,packages/genui/playground/src/pages/bench/**,packages/genui/server/rslib.config.ts"
---

A2UI bench jobs run agent generation and validation in `genui-server`, but browser-backed render metrics and screenshots remain disabled. Keep browser metrics marked as disabled in reports.

Let every comparison group select its model independently, but expose and accept only public model names returned by the GenUI server. Do not add a free-form Bench model input or reinterpret an unknown group model as an upstream model ID.

Use the Rust HTTP sidecar for screenshots and deterministic comparison, and GenUI Server for model evaluation. Configure the capture service through `UI_JUDGE_SERVER_URL` or a normalized credential-free job-level `playground.uiJudgeServerUrl`; keep bundle URLs server-owned. Probe `GET /health`, then send sanitized page data to `POST /screenshot/template`. Convert the returned BMP to PNG before scoring with the Bench group's GenUI model. Reject nonempty `judgeSteps` before capture; do not extend remote interaction.

Treat UI Judge scoring as atomic at the Bench boundary. Any visual-score, GEQI dimension, aggregate-contract, request, or response error must set both the judge and the containing run to failed, force the persisted judge score to zero, omit partial dimension and GEQI aggregates, and exclude the run from Judge averages. Apply this consistently to native A2UI and protocol-adapter A2UI/OpenUI paths; keep screenshots and error messages only as failure diagnostics.

Decode only the runner's top-down 32-bit BITMAPV4HEADER layout with its RGBA masks. Bound input bytes and dimensions before allocation, and preserve alpha during asynchronous PNG compression. Set `mediaType: "image/png"` on Mastra image parts so its message conversion does not default to JPEG. Cover the real provider and structured-output path with deterministic HTTP responses, including local data-URL decoding. Use the full converted PNG for model evaluation; apply the separate per-image and per-job limits only when storing Bench screenshots. Malformed captures fail evaluation. Preserve the visual-correctness score and four GEQI dimensions with weights 30/25/15/15, normalized to 0-100. Reuse the GenUI provider, reasoning settings, output-token ceiling, and cancellation signal; abort sibling evaluations if a dimension fails.

Never let model-generated Bench messages make the server-side headless renderer load resources. Remove `openUrl` from every Bench prompt catalog, replace `Image`, `LazyComponent`, `LineChart`, `McpApp`, and `PieChart` definitions with inert placeholders, downgrade Markdown `Text`, and reject recursive `openUrl` function calls before calling UI Judge. The headless resource callback can otherwise read `file://` paths, access arbitrary HTTP endpoints, load executable nested bundles, or block its single capture worker on an unbounded download.

Do not add `@sparticuz/chromium` or `playwright-core` back to `packages/genui/server`. Keep the entire browser-backed implementation in `a2ui-bench-preview.ts` and its runner import and call sites commented until preview rendering moves to its dedicated service. Do not add a fallback preview implementation, capability flag, or configuration switch while it is disabled.

Bench job event streams can sit in a long-running phase without producing run events. Keep the `/a2ui/bench/jobs/[jobId]/events` SSE response alive with heartbeat comments, and let native EventSource disconnects reconnect unless the server sends an explicit `event: error` payload. Otherwise proxies or serverless hosts may close an idle stream and the playground will lose a still-running job.
