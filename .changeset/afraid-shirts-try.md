---
"@lynx-js/web-worker-runtime": minor
"@lynx-js/web-constants": patch
"@lynx-js/web-core": minor
---

feat: `nativeModulesUrl` of lynx-view is changed to `nativeModulesMap`, and the usage is completely aligned with `napiModulesMap`.

"warning: This is a breaking change."

`nativeModulesMap` will be a map: key is module-name, value should be a esm url which export default a
function with two parameters(you never need to use `this`):

- `NativeModules`: oriented `NativeModules`, which you can use to call
  other Native-Modules.

- `NativeModulesCall`: trigger `onNativeModulesCall`, same as the deprecated `this.nativeModulesCall`.

example:

```js
const nativeModulesMap = {
  CustomModule: URL.createObjectURL(
    new Blob(
      [
        `export default function(NativeModules, NativeModulesCall) {
    return {
      async getColor(data, callback) {
        const color = await NativeModulesCall('getColor', data);
        callback(color);
      },
    }
  };`,
      ],
      { type: 'text/javascript' },
    ),
  ),
};
lynxView.nativeModulesMap = nativeModulesMap;
```

In addition, we will use Promise.all to load `nativeModules`, which will optimize performance in the case of multiple modules.
