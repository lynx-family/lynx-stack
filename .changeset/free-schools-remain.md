---
"@lynx-js/web-worker-runtime": patch
"@lynx-js/web-constants": patch
"@lynx-js/web-elements": patch
"@lynx-js/web-core": patch
---

fix:

1. `LynxView.updateData()` cannot trigger `dataProcessor`.

2. **This is a break change:** The second parameter of `LynxView.updateData()` has been changed from `UpdateDataType` to `string`, which is the `processorName` (default is default). This change is to better align with Native. The current complete type is as follows:

```ts
updateData(
  data: Cloneable,
  processorName?: string,
  callback?: () => void,
) {
  this.#instance?.updateData(data, processorName, callback);
}
```
