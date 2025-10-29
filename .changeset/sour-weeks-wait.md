---
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/react-alias-rsbuild-plugin": patch
---

Support [React Compiler](https://react.dev/learn/react-compiler) for ReactLynx, enable it by set `experimental_enableReactCompiler` to `true` in `lynx.config.js`:

```js
export default defineConfig({
  plugins: [
    pluginReactLynx({
      experimental_enableReactCompiler: true,
    }),
  ],
});
```
