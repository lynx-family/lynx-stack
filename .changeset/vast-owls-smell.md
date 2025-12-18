---
'@lynx-js/react': patch
---

Add `getComputedStyleByKey` for `MainThread.Element`, now you can measure elements in sync.

```typescript
function getStyle(ele: MainThread.Element) {
  'main thread';
  const width = ele.getComputedStyleByKey('width'); // Returns 300px
  const transformMatrix = ele.getComputedStyleByKey('transform'); // Returns matrix(2, 0, 0, 2, 200, 400)
}
```
