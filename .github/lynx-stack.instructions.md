---
applyTo: "packages/web-platform/web-elements/**/*"
---

When updating web element APIs, add targeted Playwright tests in packages/web-platform/web-elements/tests/web-elements.spec.ts and keep changes minimal.
Ensure Playwright browsers are installed (pnpm exec playwright install --with-deps <browser>) before running web-elements tests.
For x-input type="number" in web-elements, keep inner input type as text, set inputmode="decimal", and filter number input internally without setting input-filter explicitly.
Add new web-elements UI fixtures under packages/web-platform/web-elements/tests/fixtures and commit matching snapshots in packages/web-platform/web-elements/tests/web-elements.spec.ts-snapshots.

---
applyTo: "packages/react/runtime/src/**/*"
---

The delayed event queue exported from packages/react/runtime/src/lifecycle/event/delayEvents.ts is lazily initialized and may be undefined until the first delayed publish; when draining it, read it into a local variable, guard for undefined, and then clear that same array instance.
