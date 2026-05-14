---
applyTo: "packages/web-platform/**/tests/**/*.ts,.github/workflows/**/*.yml"
---

For Playwright tests that assert async browser events, prefer locator auto-waiting, `page.waitForEvent`, or `expect.poll` over fixed `wait(...)` sleeps followed by one-shot reads such as `innerText()` or boolean flag checks. Firefox and WebKit CI can dispatch input, selection, scroll, and worker cleanup events later than Chromium.

When adding or changing reusable web CI jobs, keep `web-report-path` aligned with the package that actually runs Playwright so failure artifacts upload from the correct `playwright-report` directory.

When Playwright failures are dominated by browser event timing, prefer increasing CI retries in the shared fixture config before lowering coverage. Keep local retries at zero so targeted reproductions still surface real failures quickly.
