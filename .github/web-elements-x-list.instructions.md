---
applyTo: "packages/web-platform/web-elements/src/elements/XList/**,packages/web-platform/web-elements/tests/fixtures/x-list/**,packages/web-platform/web-elements/tests/web-elements.spec.ts"
---

Treat `scroll-orientation` as the single source of truth for XList axis behavior. Keep `scrollLeft` and `scrollTop` mapped to the matching internal scroll-container offsets, and make axis-sensitive methods such as `autoScroll` update only the configured axis. Do not restore `vertical-orientation`-based selectors as partial compatibility; either implement a complete legacy alias across layout and runtime behavior or keep the unsupported legacy attribute absent.
