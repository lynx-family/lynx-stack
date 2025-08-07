---
"@lynx-js/react": patch
---

fix: Correctly check for the existence of background functions in MTS

```ts
function handleTap() {
  'main thread';
  // The following check always returned false before this fix
  if (myHandleTap) {
    runOnBackground(myHandleTap)();
  }
}
```
