---
"@lynx-js/react": patch
---

Use error cause to simplify the error msg of lazy bundle loading. User can catch the error cause to get the original result:

```ts
const LazyComponent = lazy(async () => {
  try {
    const mod = await import('./lazy-bundle');
    return mod.default;
  } catch (error) {
    console.error(`Lazy Bundle load failed message: ${error.message}`);
    // User can catch the error cause to get the original result
    console.error(`Lazy Bundle load failed result: ${error.cause}`);
    throw error;
  }
});
```
