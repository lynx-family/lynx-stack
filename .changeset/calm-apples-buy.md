---
"@lynx-js/react": patch
---

Supports list batch framework render with async resolve sub-tree properties and element tree.

```js
export default defineConfig({
  plugins: [
    pluginReactLynx({
      enableParallelElement: true,
    }),
    // ...
  ],
});
```

```tsx
<list
  /*
    (1) experimental-batch-render-strategy={0}: Not enable batch render.
    (2) experimental-batch-render-strategy={1}: Only Enable batch render.
    (3) experimental-batch-render-strategy={2}: Enable batch render with async resolve property of list item subtree.
    (4) experimental-batch-render-strategy={3}: Enable batch render with async resolve property and async resolve element tree of list item subtree.
    */
  experimental-batch-render-strategy={3}
>
```
