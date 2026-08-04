---
"@lynx-js/react": minor
"@lynx-js/react-webpack-plugin": minor
"@lynx-js/react-rsbuild-plugin": minor
---

Add the root-level `<Background fallback={…}>` declarative API over `enableMTSRendering: false`.

```tsx
import { Background, root } from '@lynx-js/react';

root.render(
  <page>
    <Background fallback={<Skeleton />}>
      <App />
    </Background>
  </page>,
);
```

- `@lynx-js/react` exports the `<Background>` first-screen boundary component: the main thread renders `fallback`, the background thread renders `children`, and the first-screen hydration replaces the fallback with the real content. Nested in the app it defers a subtree; at the render root it declares a 0.0 first screen.
- `enableMTSRendering` widens to `boolean | 'auto'` and defaults to `'auto'`: production builds detect a root-level `<Background>` in the entry sources and stop compiling the deferred subtree for the main thread, while development builds keep the classic path with HMR intact. The explicit booleans stay as escape hatches.
- On the main-thread target the transform folds `<Background fallback={F}>{C}</Background>` to `F`, so the reference that would keep the app's module closure in the main-thread bundle is gone, while the fallback is compiled for the main thread as ordinary code. **The fallback may therefore contain user components, hooks and computed children** — it is not restricted to static host elements. The app's element definitions still travel to the main thread through the assembled definitions, so hydration can build the real tree.
- The fold is purely syntactic and needs no inference from the shape of the tree: a `<page>` (or any other host) wrapper around the boundary is left untouched, an aliased `Background` import is followed, and a nested `<Background>` inside a fallback folds to its own fallback. A spread on `<Background>` is a build error rather than a silent fold.
