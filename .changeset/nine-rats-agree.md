---
"@lynx-js/react": patch
---

Support return value for `runOnBackground()` and `runOnMainThread()`.

Now you can get the return value from `runOnBackground()` and `runOnMainThread()`, which enables more flexible data flow between the main thread and the background thread.

```js
import { runOnBackground } from '@lynx-js/react';

const onTap = async () => {
  'main thread';
  const text = await runOnBackground(() => {
    'background only';
    return 'Hello, world!';
  })();
  console.log(text);
};
```
