---
"@lynx-js/runtime-wrapper-webpack-plugin": patch
---

Avoid override user defined fetch function, specify `injectGlobalFetch: false` to `pluginReactLynx` to disable global injection of `fetch` function.

```js
pluginReactLynx({
  injectGlobalFetch: false,
}),
```
