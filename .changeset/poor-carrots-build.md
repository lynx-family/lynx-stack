---
"@lynx-js/template-webpack-plugin": patch
---

fix: when enableCSSSelector is false, the CSS style with className h-[40px] will not work.

This is because when the CSS selector contains special characters (such as `\`, `[`, `]`, `/`, `(`, `)`), the CSS style needs to be escaped with the character `\`, but the className does not need this.

The escape characters are filtered during building to ensure that that two parts are completely consistent.
