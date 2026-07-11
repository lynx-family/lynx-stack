---
"@lynx-js/react": minor
---

Add `root.hydrate()` and `root.render(jsx, { hydrate: false })` — an imperative, composable API for the hydration handover.

`root.hydrate()` performs (or awaits) the handover: the background thread reconciles against the main-thread first-screen tree and takes the UI ownership over. The returned promise resolves when the handover completes on the calling thread. `root.render(jsx, { hydrate: false })` splits the two verbs: the framework no longer hands over on its own, and the main thread keeps responding to data updates synchronously until `root.hydrate()` is called — no build configuration needed, because the root options run on both threads before `renderPage`.

```ts
import { root } from '@lynx-js/react';

root.render(<App />, { hydrate: false });

// Take over once the data is ready, but never wait longer than 300ms.
await Promise.race([dataReady, timeout(300)]);
await root.hydrate();
```

The `firstScreenSyncTiming` presets keep working and map onto the new model: `'immediately'` and `'jsReady'` are automatic handovers (where `root.hydrate()` simply awaits the completion), and `'manual'` is a held handover (where it also triggers). `markFirstScreenSyncReady()` is deprecated in favor of `root.hydrate()`.

Note that until the handover completes, updates rendered by the background thread are not visible and background event handlers are queued — every "wait" before `hydrate()` should come with a timeout or another bound.

On the element template backend, `root.hydrate()` awaits the (automatic) handover on the background thread; a held handover is not supported there yet.
