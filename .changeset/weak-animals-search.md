---
'@lynx-js/react': patch
---

Add `animate` API in Main Thread Script(MTS), so you can now control a CSS animation imperatively

```ts
import type { MainThread } from '@lynx-js/types';

function startAnimation(ele: MainThread.Element) {
  'main thread';
  const animation = ele.animate([
    { opacity: 0 },
    { opacity: 1 },
  ], {
    duration: 3000,
  });

  // Can also be paused
  // animation.pause()
}
```
