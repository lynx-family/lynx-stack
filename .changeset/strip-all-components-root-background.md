---
"@lynx-js/react-rsbuild-plugin": minor
"@lynx-js/react-webpack-plugin": minor
"@lynx-js/react": patch
---

Light up a whole-program strip when a root-level `<Background>` is detected, keeping every component's render logic out of the main-thread (LEPUS) bundle.

A `<Background>` at the render root declares a 0.0 first screen: the whole first frame is the static `fallback`, and nothing renders on the main thread. Under that condition it is safe to empty _every_ component render body from the main-thread bundle — no `'background only'` annotation needed. The build detects the root `<Background>` in an entry and turns this on automatically:

```tsx
import { Background, root } from '@lynx-js/react';

root.render(
  // host-element fallback only — component bodies are gone from the main thread
  <Background
    fallback={
      <view>
        <text>Loading…</text>
      </view>
    }
  >
    <App />
  </Background>,
);
```

The element (snapshot) and main-thread-script (worklet) definitions the first-screen hydration needs are hoisted to module scope before the strip, so they are retained; only the render bodies (and the logic-only modules they reached) are shaken out. The background thread is untouched — it renders and hydrates the full tree.

Auto-detection can be overridden with the internal `experimental_stripAllComponents` option (`true`/`false` forces or forbids the strip regardless of detection). Because component bodies no longer exist on the main thread, a root `<Background>`'s `fallback` must be composed of host elements rather than user components.

Unlike the per-component `'background only'` opt-out, this is the whole-program (0.0) endpoint of the same boundary; unlike a runtime-only switch, the render logic is physically absent from the main-thread bundle rather than merely skipped.
