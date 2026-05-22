---
applyTo: "packages/genui/ui-judge/**/*"
---

When extending `@lynx-js/ui-judge`, keep `judgePage` as the only public runtime API until a caller needs more surface area. Callers own Playwright page setup, navigation, viewport, cookies, route mocks, and authentication. Additional dimensions should remain internal unless they are intentionally added to the package exports.

Midscene scoring in this package should use `aiNumber()` and return a JSON-serializable integer score from 0 to 5. Prompt text must cooperate with Midscene's `aiNumber()` parser by asking for the requested `Number` field, not a bare JSON number. Do not reintroduce letter grades or `GRADE:` output in prompts.

Avoid writing screenshots by default. Playwright and Midscene may capture the page internally, but persistent screenshot artifacts should require an explicit future option.

Midscene currently brings in `sharp`; keep its pnpm build-script policy explicit in `pnpm-workspace.yaml` rather than letting `pnpm install` leave the placeholder value.

Model-backed Playwright tests should use the real Midscene service when `MIDSCENE_MODEL_NAME` is configured, and skip only the model-dependent cases when that environment variable is absent. Keep the playground server startup inside the skipped model-backed test group so non-model validation tests do not bind local ports.

Prefer `page.setContent()` or another non-listening fixture setup for static `@lynx-js/ui-judge` Playwright fixtures. Avoid starting local HTTP servers in package tests unless the behavior under test specifically needs network navigation.

When a `@lynx-js/ui-judge` Playwright test needs real network navigation, use the A2UI playground preview server rather than a package-local scratch HTTP server. Start `pnpm dev` from `packages/genui/a2ui-playground` and navigate Playwright to the playground `render.html` demo route, such as `/render.html?protocol=a2ui&demoUrl=.%2Fa2ui.web.js&theme=light&demo=recs&speed=0`.

The A2UI playground preview server requires generated catalog artifacts from `@lynx-js/a2ui-reactlynx`. If they are missing, fail with a clear prerequisite message that points to `pnpm --filter @lynx-js/a2ui-reactlynx build` instead of silently running broad cross-package builds from Playwright hooks.

The Codex sandbox blocks TCP listeners on loopback addresses such as `127.0.0.1`, `localhost`, `0.0.0.0`, and `::1`, so bind-dependent verification should use an escalated command such as `pnpm --filter @lynx-js/ui-judge test` rather than rewriting the test to avoid the bind.
