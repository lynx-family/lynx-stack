---
"@lynx-js/web-core": patch
"@lynx-js/template-webpack-plugin": patch
---

Support CSS `@media` on Lynx for Web.

`@media` rules were parsed but dropped by both the binary and the JSON web style encodings. They are now carried as a `MediaRule` (nested rules, including nested `@media`, are encoded like top-level ones) and emitted as native `@media` blocks, so width, height, resolution and `prefers-color-scheme` queries follow the browser viewport and update live when it changes. Rules inside `@media` keep their selectors when `enableCSSSelector` is `false`.
