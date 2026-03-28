---
"@lynx-js/web-core": minor
---

Added support for `rpx` unit

**This is a breaking change**

The following Styles has been added to `web-core`

```css
lynx-view {
  width: 100%;
  container-name: lynx-view;
  container-type: inline-size;
  --rpx-unit: 1cqw;
}
```

Check MDN for the details about these styles:

- https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/container-name
- https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/container-type
- https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_queries

### how it works?

For the following code

```html
<view style="height:1rpx">
```

it will be transformed to

```html
<view style="height:calc(1 * var(--rpx-unit))">
```

Therefore you could use any `<length>` value to replace the unit, for example:

```html
<lynx-view style="--rpx-unit:1px">
```

By default, the --rpx-unit value is `1cqw`
