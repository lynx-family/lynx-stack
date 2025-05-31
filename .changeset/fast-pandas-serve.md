---
"@lynx-js/react": patch
---

Add Lynx API `lynx.experimental_addLazyBundleResponseListener`, which allows developer to

```tsx
if (__BACKGROUND__) {
  lynx
    .getJSModule('GlobalEventEmitter')
    .addListener('experimental_onLazyBundleResponse', (result) => {
      console.log(result);
    });
}
```

If you want to use this event in functional components, you can use the `useLynxGlobalEventListener` hook:

```tsx
import { useLynxGlobalEventListener } from '@lynx-js/react';
function FC() {
  useLynxGlobalEventListener('experimental_onLazyBundleResponse', (result) => {
    console.log(result);
  });

  return <view>...</view>;
}
```
