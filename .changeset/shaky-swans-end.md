---
"@lynx-js/react": patch
---

Remove and insert `list-item`s whose `item-key` have been changed.

For example:

```diff
-<list-item key={key /* "key1" */} item-key={itemKey /* "0xAFDFDA" */}>
+<list-item key={key /* "key1" */} item-key={itemKey /* "0xAFDFDB" */}>
  ...
</list-item>
```

the item-key has been changed from `0xAFDFDA` to `0xAFDFDB`, but the key remains the same. ReactLynx will think the item is the same and will not remove and insert it, but list in Lynx Engine will think the item is different and will expect it to be removed and inserted.
