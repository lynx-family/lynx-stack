---
"@lynx-js/web-worker-runtime": patch
"@lynx-js/web-constants": patch
"@lynx-js/web-core": patch
---

feat: add two prop of lynx-view about `napiLoader`:

- `napiModulesMap`: [optional] the napiModule which is called in lynx-core. key is module-name, value is esm url.

- `onNapiModulesCall`: [optional] the NapiModule value handler.

**Warning:** This is the internal implementation of `@lynx-js/lynx-core`. In most cases, this API is not required for projects.

1. The `napiModulesMap` value should be a esm url which export default a function with two parameters:

- `NapiModules`: oriented `napiModulesMap`, which you can use to call other Napi-Modules

- `NapiModulesCall`: trigger `onNapiModulesCall`

example:

```js
const color_environment = URL.createObjectURL(
  new Blob(
    [`export default function(NapiModules, NapiModulesCall) {
  return {
    getColor() {
      NapiModules.color_methods.getColor({ color: 'green' }, color => {
        console.log(color);
      });
    },
    ColorEngine: class ColorEngine {
      getColor(name) {
        NapiModules.color_methods.getColor({ color: 'green' }, color => {
          console.log(color);
        });
      }
    },
  };
};`],
    { type: 'text/javascript' },
  ),
);

const color_methods = URL.createObjectURL(
  new Blob(
    [`export default function(NapiModules, NapiModulesCall) {
  return {
    async getColor(data, callback) {
      const color = await NapiModulesCall('getColor', data);
      callback(color);
    },
  };
};`],
    { type: 'text/javascript' },
  ),
);

lynxView.napiModuleMap = {
  'color_environment': color_environment,
  'color_methods': color_methods,
};
```

2. The `onNapiModulesCall` function has three parameters:

- `name`: the first parameter of `NapiModulesCall`, the function name
- `data`: the second parameter of `NapiModulesCall`, data
- `moduleName`: the module-name of the called napi-module

```js
lynxView.onNapiModulesCall = (name, data, moduleName) => {
  if (name === 'getColor' && moduleName === 'color_methods') {
    return data.color;
  }
};
```
