---
"@lynx-js/react": minor
"@lynx-js/react-rsbuild-plugin": minor
"@lynx-js/react-webpack-plugin": minor
---

Add `firstScreenSyncTiming: 'manual'` and a new `markFirstScreenSyncReady()` API exported by `@lynx-js/react`.

In `'manual'` mode, the main thread holds the UI control after the first screen until the business calls `markFirstScreenSyncReady()`, so the handover timing to the background thread (for hydration) is fully controlled by the user. The API can be called from both threads (a background-thread call is forwarded to the main thread) and takes effect once the first-screen tree has finished rendering.

```js
pluginReactLynx({
  firstScreenSyncTiming: 'manual',
});
```

```js
import { markFirstScreenSyncReady } from '@lynx-js/react';

markFirstScreenSyncReady();
```
