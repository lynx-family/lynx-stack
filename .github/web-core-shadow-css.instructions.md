---
applyTo: "packages/web-platform/web-core/css/**,packages/web-platform/web-core/ts/client/**"
---

Keep the `<lynx-view>` host and page baseline styles available inside its shadow root by importing them through `css/in_shadow.css`. Until the public `client.prod.css` compatibility asset is removed, keep the shared rules valid in both contexts: pair `:host(...)` with `lynx-view...` for the host and pair shadow-local page selectors with `lynx-view::part(page)`.
