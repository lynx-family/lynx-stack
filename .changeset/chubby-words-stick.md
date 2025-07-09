---
"@lynx-js/testing-environment": patch
"@lynx-js/react": patch
---

Supports alog of component rendering on production for better error reporting. Enable it by define `__ALOG__` to `true` in `lynx.config.js`:

```js
export default defineConfig({
  // ...
  source: {
    define: {
      __ALOG__: true,
    },
  },
});
```
