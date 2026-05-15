---
applyTo: "packages/web-platform/**/tests/**/*.{ts,tsx}"
---

For Playwright tests that assert async browser behavior, prefer locator assertions, `expect.poll`, or `page.waitForFunction` that waits for the exact rendered/event state under test instead of fixed `wait(ms)` followed by a one-shot `innerText`, `count`, or array assertion. Keep the original behavior assertion intact: wait for the same text, CSS value, event count, worker count, or parsed event payload that the test is meant to prove.
