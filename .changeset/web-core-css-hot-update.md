---
"@lynx-js/web-core": patch
---

Apply CSS hot updates on web. The main-thread `lynx.getDevtool().replaceStyleSheetByIdWithBase64`, which the CSS hot update runtime of `@lynx-js/css-extract-webpack-plugin` calls, now replaces the style sheets of the card or of a lazy bundle with the CSS of the update. Without `enableCSSSelector`, it also recomputes the styles of the entry's elements. Before, the main-thread `lynx` had no `getDevtool`, so a CSS change on web needed a reload.
