---
"@lynx-js/react": patch
---

Add global event `unstable_onLazyBundleResponse`.
```tsx
if (_JS__) {
  lynx
    .getJSModule('GlobalEventEmitter')
    .addListener('unstable_onLazyBundleResponse', (result) => {
      console.log(result);
    });
}
```
