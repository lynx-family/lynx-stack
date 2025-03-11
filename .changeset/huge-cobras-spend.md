---
"@lynx-js/web-worker-runtime": patch
"@lynx-js/web-constants": patch
"@lynx-js/web-core": patch
---

feat: add new prop `onNapiLoaderCall` of lynx-view, which is the `napiLoader` value handler in `@lynx-js/lynx-core`. key is moduleName which is called in `napiLoader.load(moduleName)`, value is esm url.

Each function and class of napiLoader-module will be bound to a function nativeModules. You can use `this.nativeModules` to call nativeModules.

example:

```js
const color_environment = URL.createObjectURL(
  new Blob(
    [
      `export default {
  getColor() {
    this.nativeModules.CustomModule.getColor({ color: 'green' }, color => {
      console.log(color)
    });
  },
  ColorEngine: class ColorEngine {
    getColor(name) {
      this.nativeModules.CustomModule.getColor({ color: 'green' }, color => {
        console.log(color)
      });
    }
  },
};`,
    ],
    { type: 'text/javascript' },
  ),
);

lynxView.onNapiLoaderCall = {
  'color_environment': color_environment,
};
```
