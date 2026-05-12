---
applyTo: "packages/web-platform/web-elements/**/*"
---

When updating web element APIs, add targeted Playwright tests in packages/web-platform/web-elements/tests/web-elements.spec.ts and keep changes minimal.
Ensure Playwright browsers are installed (pnpm exec playwright install --with-deps <browser>) before running web-elements tests.
For x-input type="number" in web-elements, keep inner input type as text, set inputmode="decimal", and filter number input internally without setting input-filter explicitly.
Add new web-elements UI fixtures under packages/web-platform/web-elements/tests/fixtures and commit matching snapshots in packages/web-platform/web-elements/tests/web-elements.spec.ts-snapshots.

---
applyTo: "packages/webpack/template-webpack-plugin/**/*"
---

When changing initial CSS handling in template-webpack-plugin, add or update a code-splitting case that asserts the exact selector order in `tasm.json`, not just that CSS assets exist.
Prefer a shared-plus-split initial chunk fixture when validating CSS merge order so the expected rule sequence follows the source import order clearly.

---
applyTo: ".github/workflows/**/*"
---

Do not add file descriptor limit shell adjustments in GitHub Actions; hosted runners may reject them.

---
applyTo: "packages/web-platform/web-core-e2e/**/*"
---

For ReactLynx Playwright coverage in web-core-e2e, add fixtures under `tests/reactlynx/<test-title>/index.jsx` and use the same `<test-title>` string in `tests/reactlynx.spec.ts`.
Skip WebKit for tests that depend on `page.mouse.wheel`, since the existing suites treat WebKit wheel support as unavailable.
