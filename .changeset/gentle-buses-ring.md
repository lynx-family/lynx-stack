---
"@lynx-js/react": patch
---

feat: add compiler only version of addComponentElement, it does not support spread props but have no runtime overhead, use it by:

```js
pluginReactLynx({
  compat: {
    addComponentElement: {
      compilerOnly: true,
    },
  },
});
```
