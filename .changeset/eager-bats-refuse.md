---
"@lynx-js/react-webpack-plugin": patch
---

Shake `useImperativeHandle` on the main-thread by default.

```js
import { forwardRef, useImperativeHandle } from '@lynx-js/react';

export default forwardRef(function App(_, ref) {
  useImperativeHandle(ref, () => {
    // This should be considered as background only
    return {
      name() {
        // This should be considered as background only
        console.info('This should not exist in main-thread');
      },
    };
  });
});
```
