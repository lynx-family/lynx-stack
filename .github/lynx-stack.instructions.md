---
applyTo: "packages/web-platform/web-elements/**/*"
---

When updating web element APIs, add targeted Playwright tests in a dedicated spec file under packages/web-platform/web-elements/tests and keep changes minimal.
Ensure Playwright browsers are installed (pnpm exec playwright install --with-deps <browser>) before running web-elements tests.

For x-markdown updates, keep markdown-style injected via a shadow-root style tag and render markdown only on attribute changes.
