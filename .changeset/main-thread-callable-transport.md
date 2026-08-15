---
"@lynx-js/react": patch
---

Add `MainThreadCallable`, `useMainThreadCallable` and `useMainThreadCallables`: a lifecycle-managed callable transport that registers consumer-authored main-thread functions (including functions nested inside objects and arrays, such as easing function arrays in a transition object) as stable main-thread callables, re-synchronizes their captured values on every committed render, and releases them on unmount.

```tsx
import { useMainThreadCallables, runOnMainThread } from '@lynx-js/react';

function MyMotionComponent(props) {
  // props.transition may contain nested easing functions:
  // { duration: 0.8, ease: [(p) => { 'main thread'; return p }, ...] }
  const transition = useMainThreadCallables(props.transition);

  function applyAnimation(options) {
    'main thread';
    // options.ease[0] is a callable function here.
  }
  // ...
}
```
