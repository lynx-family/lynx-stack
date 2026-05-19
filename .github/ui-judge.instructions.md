---
applyTo: "packages/genui/ui-judge/**/*"
---

When extending `@lynx-js/ui-judge`, keep `judgePage` as the only public runtime API until a caller needs more surface area. Callers own Playwright page setup, navigation, viewport, cookies, route mocks, and authentication. Additional dimensions should remain internal unless they are intentionally added to the package exports.

Midscene scoring in this package should use `aiNumber()` and return a JSON-serializable integer score from 0 to 5. Do not reintroduce letter grades or `GRADE:` output in prompts.

Avoid writing screenshots by default. Playwright and Midscene may capture the page internally, but persistent screenshot artifacts should require an explicit future option.

Midscene currently brings in `sharp`; keep its pnpm build-script policy explicit in `pnpm-workspace.yaml` rather than letting `pnpm install` leave the placeholder value.

Model-backed Playwright tests should use the real Midscene service when `MIDSCENE_MODEL_NAME` is configured, and skip only the model-dependent cases when that environment variable is absent.
