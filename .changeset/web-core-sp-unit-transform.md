---
"@lynx-js/web-core": patch
---

Add an opt-in `sp` unit transform. Set the `transform-sp` attribute or the `transformSP` property on `<lynx-view>` to rewrite `sp` lengths in stylesheets and inline styles to `calc(N * var(--sp-unit))`. `--sp-unit` defaults to `1px`; set it on the `<lynx-view>` to follow the system font scale.

```html
<lynx-view url="https://example.com/template.js" transform-sp="true" style="--sp-unit: 1.3px"></lynx-view>
```
