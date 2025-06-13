---
"@lynx-js/template-webpack-plugin": patch
"@lynx-js/css-serializer": patch
---

Remove the backslash escapes in selector when the `enableCSSSelector` option is disabled.

For example:

```css
.h-\[370px\] {
  height: 370px;
}
```

When `enableCSSSelector` is disabled, the selector `.h-\[370px\]` should be transformed to `.h-[370px]` to ensure compatibility with the CSS selector engine.
