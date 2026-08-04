---
"@lynx-js/react": minor
"@lynx-js/react-webpack-plugin": minor
"@lynx-js/react-rsbuild-plugin": minor
---

Add the root-level `<Background fallback={…}>` declarative API over `experimental_enableMTSRendering: false`.

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
- `experimental_enableMTSRendering` widens to `boolean | 'auto'` and defaults to `'auto'`: production builds detect a `<Background>` anywhere in the entry's module graph and stop compiling the deferred subtrees for the main thread, while development builds keep the classic path with HMR intact. The explicit booleans stay as escape hatches.
- On the main-thread target the transform folds `<Background fallback={F}>{C}</Background>` to `F`, so the reference that would keep the app's module closure in the main-thread bundle is gone, while the fallback is compiled for the main thread as ordinary code. **The fallback may therefore contain user components, hooks and computed children** — it is not restricted to static host elements. The app's element definitions still travel to the main thread through the assembled definitions, so hydration can build the real tree.
- The fold is purely syntactic and needs no inference from the shape of the tree: a `<page>` (or any other host) wrapper around the boundary is left untouched, an aliased `Background` import is followed, and a nested `<Background>` inside a fallback folds to its own fallback. A spread on `<Background>` is a build error rather than a silent fold.
- The mode is no longer gated on the boundary being at the render root: detection follows the entry's relative imports, so a `<Background>` nested inside a component turns it on too. Each boundary is folded where it stands, so an app may have any number of them — the surrounding tree positions each fallback, and one hydration pass replaces them all independently.
- The assembled definitions subtract what the main-thread bundle already carries: a fallback compiled for the main thread is not also described by the assembly, which otherwise duplicated one definition per island.
- Detection asks whether a module _binds_ `Background` from `@lynx-js/react`, not whether it writes a `<Background>` element, so an alias, a namespace import, a re-export or a computed element type no longer hides the boundary from it. Getting this wrong the safe-looking way is not a missed optimization but a blank first screen: the entry would not be compiled for the main thread at all, leaving it with nothing to render. A false positive costs close to nothing — the entry compiles as it would have, and the assembly subtracts everything the main-thread bundle already owns.
- The assembled main thread enters through a single generated module rather than two entry imports. As two, every module the definitions runtime and the app's entry share — the whole main-thread runtime — was reachable from two concatenation roots and dropped out of scope hoisting, making the assembled `main-thread.js` around 40 KB _larger_ than the classic build it exists to shrink.
