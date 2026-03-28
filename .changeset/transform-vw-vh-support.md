---
"@lynx-js/web-core": minor
---

Added support for transform `vw` and `vh` unit

Add `transform-vw` and `transform-vh` attributes and properties on `<lynx-view>`.

For the following code

```html
<view style="height:1vw">
```

If the `transform-vw` is enabled `<lynx-view transform-vw="true">`, it will be transformed to

```html
<view style="height:calc(1 * var(--vw-unit))">
```

Therefore you could use any `<length>` value to replace the unit, for example:

```html
<lynx-view style="--vw-unit:1px">
```
