---
"@lynx-js/react": patch
---

Add `useMainThreadEvent` and `useMainThreadEvents`: main-thread event functions in the lineage of React's `useEvent`/`useEffectEvent`, built on a lifecycle-managed callable transport. A consumer-authored main-thread function (including functions nested inside objects and arrays, such as easing function arrays in a transition object) becomes a serializable handle that resolves on the main thread to an identity-stable function whose captured values re-synchronize on every committed render and release on unmount.

```tsx
import { useMainThreadEvents, runOnMainThread } from '@lynx-js/react';

function MyMotionComponent(props) {
  // props.transition may contain nested easing functions:
  // { duration: 0.8, ease: [(p) => { 'main thread'; return p }, ...] }
  const transition = useMainThreadEvents(props.transition);

  function applyAnimation(options) {
    'main thread';
    // options.ease[0] is a callable function here.
  }
  // ...
}
```
