---
'@lynx-js/react': patch
---

fix: gesture config not processed correctly

```typescript
const pan = Gesture.Pan().minDistance(100);
```

After this commit, gesture config like `minDistance` should work as expected.
