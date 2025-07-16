---
"@lynx-js/react": patch
---

`<list-item/>` deferred now accepts an object with `unmountRecycled` property to control unmounting behavior when the item is recycled.

For example, you can use it like this:

```jsx
<list-item defer={{ unmountRecycled: true }} item-key='1'>
  <WillBeUnmountIfRecycled />
</list-item>;
```

Now the component will be unmounted when it is recycled, which can help with performance in certain scenarios.
