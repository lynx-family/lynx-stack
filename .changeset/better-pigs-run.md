---
'@lynx-js/react': patch
---

Add support for `MainThreadValue` to enable Main Thread Persistent Data other than `MainThreadRef`, to make library developers able to create their own main thread values.

```
// Library code
import { MainThreadValue } from '@lynx-js/react'

class MotionValue extends MainThreadValue {
  static type = '@example/motion-value';

  constructor(initValue: T) {
    super(initValue, MotionValue.type);
  }

  get value() {
    return this.getValueOnMainThread();
  }

  set value(v) {
    return this.setValueOnMainThread(v);
  }
}

MainThreadValue.register(MotionValue, MotionValue.type);

export function useMotionValue<T>(initValue: T): MotionValue<T> {
  return useMemo(() => new MotionValue(initValue), []);
}

// User code
function App() {
  const opacity = useMotionValue(1);

  function handleTap() {
    'main thread'
    opacity.value = 123
  }
}
```
