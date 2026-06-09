---
applyTo: "packages/genui/ui-judge/**/*"
---

When extending `@lynx-js/ui-judge`, keep the public runtime API small and platform-specific. Playwright callers use `judgePage` and own page setup, navigation, viewport, cookies, route mocks, and authentication. Additional dimensions should remain internal unless they are intentionally added to the package exports.

Keep `packages/genui/ui-judge/src/index.ts` as a public facade that only re-exports the supported API and public types. Put shared judge orchestration, option normalization, dimensions, and prompt construction under `src/core`, and keep platform-specific adapters such as Playwright and Kitten-Lynx/Android outside `core`, with low-level device or screenshot helpers under `src/platforms`.

When adding Android support to `@lynx-js/ui-judge`, keep the public call shape close to `judgePage`: accept the `KittenLynxView` returned by `@lynx-js/kitten-lynx-test-infra`'s `newPage()` as `page`. Callers should own the Kitten-Lynx connection, navigation, and teardown lifecycle, while UI Judge creates the internal Midscene agent adapter. For Android scoring, pass `screenshotIncluded: true` without web-only DOM requirements, and return `page.url()` through the existing result `url` field.

When a `@lynx-js/ui-judge` platform adapter subclasses Midscene's `AbstractInterface`, import `AbstractInterface` as a runtime value from `@midscene/core/device`. Midscene declares several optional abstract members that still participate in declaration-build checks; use `declare` members for unsupported optional capabilities so the adapter type-checks without adding runtime stub methods that Midscene might detect and call.

Keep Android-specific `@lynx-js/ui-judge` tests on Vitest rather than Playwright. Use a dedicated `test:android` script and let Playwright tests stay under `test:playwright`, so the Android emulator CI job can run UI Judge's Kitten-Lynx coverage without pulling in browser fixtures.

Midscene scoring in this package should use `aiAct()` and parse the final returned score into an integer from 0 to 5. For scoring-only prompts, make it clear that the current UI state is enough, no actions should be emitted, and the agent should complete immediately with exactly one concrete `SCORE: 0` through `SCORE: 5` line. Avoid placeholder text such as angle-bracketed score variables, because model-backed CI may copy the placeholder verbatim. Do not reintroduce letter grades or `GRADE:` output in prompts.

GEQI model-backed scoring should run each playground demo across the five weighted dimensions: usability-interaction (30), visual-aesthetics (25), consistency-standards (15), architecture-writing (15), and accessibility-performance (15). Keep the original visual-correctness judge as its own test and result score. Attach GEQI scores under each example result's `dimensions` array with `dimensionLabel` and `weight`, so the PR comment can summarize the weighted 100-point GEQI score while rendering one table row per example.

Avoid writing screenshots by default. Playwright and Midscene may capture the page internally, but persistent screenshot artifacts should require an explicit future option.

Midscene currently brings in `sharp`; keep its pnpm build-script policy explicit in `pnpm-workspace.yaml` rather than letting `pnpm install` leave the placeholder value.

Model-backed Playwright tests should use the real Midscene service when `MIDSCENE_MODEL_NAME` is configured, and skip only the model-dependent cases when that environment variable is absent. Keep the playground server startup inside the skipped model-backed test group so non-model validation tests do not bind local ports.

Prefer `page.setContent()` or another non-listening fixture setup for static `@lynx-js/ui-judge` Playwright fixtures. Avoid starting local HTTP servers in package tests unless the behavior under test specifically needs network navigation.

When a `@lynx-js/ui-judge` Playwright test needs real network navigation, use the A2UI playground preview server rather than a package-local scratch HTTP server. Start `pnpm dev` from `packages/genui/a2ui-playground` and navigate Playwright to the playground `render.html` demo route, such as `/render.html?protocol=a2ui&demoUrl=.%2Fa2ui.web.js&theme=light&demo=recs&speed=0`.

The A2UI playground preview server requires generated catalog artifacts from `@lynx-js/a2ui-reactlynx`. If they are missing, fail with a clear prerequisite message that points to `pnpm --filter @lynx-js/a2ui-reactlynx build` instead of silently running broad cross-package builds from Playwright hooks.

The Codex sandbox blocks TCP listeners on loopback addresses such as `127.0.0.1`, `localhost`, `0.0.0.0`, and `::1`, so bind-dependent verification should use an escalated command such as `pnpm --filter @lynx-js/ui-judge test` rather than rewriting the test to avoid the bind.
