---
"@lynx-js/react": patch
---

Add `GlobalLazyBundleResponseListener`, which allows developer to listen on response of loading a lazy bundle:

```tsx
root.render(
  <>
    <App />
    <GlobalLazyBundleResponseListener
      onResponse={(response) => {
        console.log('response', response);
      }}
    />
  </>,
);
```
