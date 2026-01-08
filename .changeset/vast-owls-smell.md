---
'@lynx-js/react': patch
---

Add `getComputedStyleProperty` for `MainThread.Element` to retrieve computed style values synchronously.

**Requires Lynx SDK >= 3.5**

```typescript
function getStyle(ele: MainThread.Element) {
  'main thread';
  const width = ele.getComputedStyleProperty('width'); // Returns 300px
  const transformMatrix = ele.getComputedStyleProperty('transform'); // Returns matrix(2, 0, 0, 2, 200, 400)
}
```
