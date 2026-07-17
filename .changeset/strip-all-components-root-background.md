---
"@lynx-js/react-rsbuild-plugin": minor
"@lynx-js/react-webpack-plugin": minor
"@lynx-js/react": patch
---

Add `experimental_stripAllComponents` — an explicit, off-by-default whole-program strip that keeps every component's render body out of the main-thread (LEPUS) bundle, with cross-module hydration kept safe by reference keep-alive.

A `<Background>` at the render root declares a 0.0 first screen: the whole first frame is the static `fallback`, and nothing renders on the main thread. That alone is a **runtime** guarantee and needs no build support — every module stays in the main-thread bundle, always safe. Removing deferred _code_ from the main thread composes per-subtree with the `'background only'` directive.

`experimental_stripAllComponents` is the whole-program endpoint of the same boundary, for the annotation-free 0.0:

- `'auto'` — strip when a root-level `<Background>` (`root.render(<Background …>…</Background>)`) is detected in an entry.
- `true` — force the strip regardless of detection.
- `false` / unset (default) — never strip.

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

Emptying a body no longer severs the component references it rendered: each emptied body hands them to an inert module-level keep-alive statement (`typeof __ifrKeepComponentRefs === "function" && __ifrKeepComponentRefs(Feed, UI)`), so delegated child modules — and their hoisted snapshot/worklet definitions — survive the unused-import DCE and the bundler's tree shaking across modules. The same keep-alive now also protects a `'background only'` component that delegates to components in other modules. Logic-only imports (call targets such as formatters) still shake out.

Because component bodies no longer exist on the main thread under the strip, a root `<Background>`'s `fallback` must be composed of host elements rather than user components; the build warns when it can see a user component in an entry's inline fallback. Component references the strip cannot see (e.g. a component resolved through a runtime value) still shake out — prefer the `'background only'` composition for such trees.
