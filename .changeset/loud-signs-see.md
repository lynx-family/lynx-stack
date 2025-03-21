---
"@lynx-js/runtime-wrapper-webpack-plugin": patch
---

Add `window` variable to callback argument in `background.js` and the `window` is `undefined` in Lynx. Sometimes it's useful to distinguish between Lynx and the Web.

```js
define('background.js', (..., window) => {
  console.log(window); // `undefined` in Lynx
})
```
