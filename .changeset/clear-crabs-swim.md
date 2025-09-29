---
'@lynx-js/react': patch
---

Add `event.stopPropagation` and `event.stopImmediatePropagation` in MTS, to help with event propagation control

```tsx
function App() {
  function handleInnerTap(event: MainThread.TouchEvent) {
    'main thread';
    event.stopPropagation();
    // Or stop immediate propagation with
    // event.stopImmediatePropagation();
  }

  // OuterTap will not be triggered
  return (
    <view main-thread:bindtap={handleOuterTap}>
      <view main-thread:bindtap={handleInnerTap}>
        <text>Hello, world</text>
      </view>
    </view>
  );
}
```

Note, if this feature is used in [Lazy Loading Standalone Project](https://lynxjs.org/react/code-splitting.html#lazy-loading-standalone-project), both the Producer and the Consumer should update to latest version of `@lynx-js/react` to make sure the feature is available.
