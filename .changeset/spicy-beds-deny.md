---
"@lynx-js/web-style-transformer": minor
"@lynx-js/web-core": minor
---

feat: add simple support for the `rpx` unit

Now you can use the `rpx` unit in Lynx Web. By default, 1rpx equals the LynxView width divided by 750 (i.e., width / 750), yielding a CSS length in px.

```html
<view style="width: 1rpx" />
```

To set a per-view rpx length, use:

```html
<lynx-view style="--rpx: 0.5px" />
```
