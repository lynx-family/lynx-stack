---
applyTo: "packages/genui/server/service/a2ui-bench-*.ts,packages/genui/server/app/a2ui/bench/**,packages/genui/playground/src/pages/BenchPage.tsx,packages/genui/server/next.config.mjs,packages/genui/turbo.json"
---

A2UI bench jobs run agent generation, validation, browser-backed render metrics, screenshots, and visual judging in `genui-server`. Keep `playwright-core` and `@sparticuz/chromium` externalized in Next.js so the browser runtime is loaded only by the Node.js bench worker. Use an explicitly configured Chromium executable when available and the serverless Chromium package only in serverless deployments.

Keep the root GenUI `build` task dependent on `^build`. The root package exports artifacts from workspace child packages such as `mcp-apps`, so consumers like Playground must not start while a child package is still cleaning or generating its `dist` directory.

Render A2UI, OpenUI, and Lynx XML through the Playground's `render.html` and `<lynx-view>` runtime so captured pixels match live Web previews. Send A2UI protocol messages through the preview bridge. Inline OpenUI source in Bench render URLs so the ReactLynx bundle receives its initial `rawText` before first load; fetching `rawTextUrl` and reloading during startup can race the Web runtime. Route Lynx XML through a same-origin ephemeral source URL inside Playwright and fulfill it with the generated artifact.

Judge the final browser screenshot with the Agent SDK visual model and preserve the 0-5 score contract. Keep the judge protocol-blind: send the same scenario task and screenshot shape for A2UI, OpenUI, and Lynx XML, and never include the group protocol, model, or implementation metadata in the judge prompt. Do not send Web-only Lynx XML to the Rust UI Judge headless runner: that runner accepts native Lynx page URLs, not zero-build Web markup. Keep judge failures on the individual run while retaining successful generation and screenshot results.

Bench job event streams can sit in a long-running phase without producing run events. Keep the `/a2ui/bench/jobs/[jobId]/events` SSE response alive with heartbeat comments, and let native EventSource disconnects reconnect unless the server sends an explicit `event: error` payload. Otherwise proxies or serverless hosts may close an idle stream and the playground will lose a still-running job.

Treat the render protocol as a property of each benchmark group, not as a separate matrix dimension. Build runs as group × scenario × repeat, choose the protocol-specific prompt and agent from the group, and preserve the derived protocol in run IDs, progress events, results, summaries, and screenshot keys. When loading older groups without a protocol field, default them to A2UI for backward compatibility.

Keep Bench as the protocol-independent top-level `#/bench` route. Protocol-scoped Bench hashes are compatibility aliases only. When browser-backed bitmap capture fails, reconstruct each successful result as a protocol-aware live Web preview from the report payload (`messages` for A2UI and `text` for OpenUI or Lynx XML) instead of presenting the slot as an empty screenshot.

Use the Agent SDK's single `maxRetries` layer for retryable upstream model errors. Do not wrap model calls in another retry loop: validation repair attempts are a separate concern, and nested retries can multiply upstream requests.
