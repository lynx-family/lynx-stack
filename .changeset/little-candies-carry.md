---
"@lynx-js/rspeedy": patch
---

Add `callerName` option to `createRspeedy`.

It can be accessed by Rsbuild plugins through [`api.context.callerName`](https://rsbuild.dev/api/javascript-api/instance#contextcallername), and execute different logic based on this identifier.

```js
export const myPlugin = {
  name: 'my-plugin',
  setup(api) {
    const { callerName } = api.context;

    if (callerName === 'rslib') {
      // ...
    } else if (callerName === 'rspeedy') {
      // ...
    }
  },
};
```
