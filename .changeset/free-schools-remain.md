---
"@lynx-js/web-worker-runtime": patch
"@lynx-js/web-constants": patch
"@lynx-js/web-elements": patch
"@lynx-js/web-core": minor
"@lynx-js/web-mainthread-apis": patch
---

fix:

1. `LynxView.updateData()` cannot trigger `dataProcessor`.

2. **This is a break change:** The second parameter of `LynxView.updateData()` has been changed from `UpdateDataType` to `string`, which is the `processorName` (default is `default` which will use `defaultDataProcessor`). This change is to better align with Native. The current complete type is as follows:

```ts
LynxView.updateData(data: Cloneable, processorName?: string | undefined, callback?: (() => void) | undefined): void
```
