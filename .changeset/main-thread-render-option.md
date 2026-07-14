---
"@lynx-js/react": minor
"@lynx-js/react-rsbuild-plugin": minor
"@lynx-js/react-webpack-plugin": minor
---

Add the `mainThreadRender` option to turn the main-thread first-screen render (IFR) off wholesale.

```js
pluginReactLynx({
  mainThreadRender: false,
});
```

When `false`, the main thread produces an empty first screen and the background render fills the screen in through the first-screen hydration — semantically equivalent to wrapping the root in a `<Background>` boundary. Use it when the whole first screen depends on data that is only available asynchronously, or as an escape hatch for code that must not run on the main thread. This is not a performance optimization: the first frame becomes empty and all content waits for the background thread.
