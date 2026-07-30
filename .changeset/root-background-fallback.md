---
"@lynx-js/react": minor
"@lynx-js/react-webpack-plugin": minor
"@lynx-js/react-rsbuild-plugin": minor
---

Add the root-level `<Background fallback={…}>` declarative API over `enableMTSRendering: false`.

```tsx
import { Background, root } from '@lynx-js/react';

root.render(
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

- `@lynx-js/react` exports the `<Background>` first-screen boundary component: the main thread renders `fallback`, the background thread renders `children`, and the first-screen hydration replaces the fallback with the real content. Nested in the app it defers a subtree; at the render root it declares a 0.0 first screen.
- `enableMTSRendering` widens to `boolean | 'auto'` and defaults to `'auto'`: production builds detect a root-level `<Background>` in the entry sources and stop compiling business code for the main thread (the #3284 assembled bundle), while development builds keep the classic path with HMR intact. The explicit booleans stay as escape hatches.
- The root fallback's snapshot definition — produced by the same background compilation that the assembled main-thread bundle is built from — is named through a new `root-fallback` define, and the `mts-rendering-disabled` main-thread entry renders it as the pre-hydration first frame: the first paint becomes the static skeleton instead of an empty page.
- Guardrails: the build warns when the root fallback contains a user component or dynamic expressions (it must compile into a single static snapshot), and when a multi-entry build leaves an entry without a root `<Background>`.
