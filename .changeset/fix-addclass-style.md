---
"@lynx-js/web-core": patch
---

fix: `__AddClass` triggers style updates when `enableCSSSelector` is `false`

`__AddClass` was missing the expected call to `update_css_og_style` when CSS selectors are disabled (`enableCSSSelector: false`). With this fix, dynamically adding a class correctly delegates style population from the template AST into the DOM, mirroring the behavior of `__SetClasses`.

Added behavioral unit test and end-to-end playwright validations using dynamically generated JSON AST `styleInfo` mocks.
