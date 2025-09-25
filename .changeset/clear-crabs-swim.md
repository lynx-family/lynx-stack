---
'@lynx-js/react': patch
---

Add `event.stopPropagation` and `event.stopImmediatePropagation` in MTS, to help with event propagation control

```typescript
function App() {
  function handleInnerTap(event: MainThread.TouchEvent) {
    'main thread';
    event.stopPropagation();
    // Or stop immediate propagation with
    // event.stopImmediatePropagation();
  }

  // OuterTap will not be triggered
  return (
    <view bindtap={handleOuterTap}>
      <view bindtap={handleInnerTap}>
        <text>Hello, world</text>
      </view>
    </view>
  );
}
```
