---
applyTo: "packages/web-platform/web-elements/**/*"
---

When updating web element APIs, add targeted Playwright tests in packages/web-platform/web-elements/tests/web-elements.spec.ts and keep changes minimal.
Ensure Playwright browsers are installed (pnpm exec playwright install --with-deps <browser>) before running web-elements tests.
For x-input type="number" in web-elements, keep inner input type as text, set inputmode="decimal", and rely on input-filter regex to allow one dot with digits.
