---
"@lynx-js/template-webpack-plugin": patch
---

Fix CSS import order when `enableCSSSelector` is false.

When the `enableCSSSelector` option is set to false, style rule priority is inversely related to `@import` order(Lynx CSS engine has the incorrect behavior). Reversing the import order to maintain correct priority is required. For example:

```css
@import "0.css";
@import "1.css";
```

will convert to:

```css
@import "1.css";
@import "0.css";
```
