---
"@lynx-js/react": patch
---

Add `useMainThreadInstance` and `useMainThreadEffect`: two further write policies over the main-thread callable slot pool introduced by `useMainThreadEvent`.

`useMainThreadInstance(create, dispose?)` is the main-thread counterpart of React's create-once instance idiom (`useState(() => new Thing())`) with a deterministic dispose: `create` runs on the main thread once, the realized object identity is stable for the component lifetime, and `dispose` runs with the realized object after the unmounting commit's patch.

`useMainThreadEffect(fn, deps?)` is the main-thread counterpart of `useLayoutEffect`: `fn` runs on the main thread after the commit's patch is applied whenever `deps` change, may return a cleanup that runs before the next run and on unmount, and observes the committed element state of the same commit.

Releases now tear down in reverse staging order (LIFO), destructor-style, so the teardown of a slot may still use anything declared before it — e.g. an effect cleanup may use an instance declared above it, whose dispose then runs after the cleanup.

```tsx
import { useMainThreadInstance, useMainThreadEffect } from '@lynx-js/react';

function MyMotionComponent(props) {
  const value = useMainThreadInstance(
    () => {
      'main thread';
      return motionValue(0);
    },
    (v) => {
      'main thread';
      v.stop();
    },
  );

  useMainThreadEffect(() => {
    'main thread';
    const controls = animate(value, props.animate);
    return () => {
      'main thread';
      controls.stop();
    };
  }, [props.animate]);
  // ...
}
```
