---
"@lynx-js/react": patch
"@lynx-js/react-webpack-plugin": patch
"@lynx-js/react-rsbuild-plugin": patch
---

Add main-thread islands: `<MainThread>` and the `'main thread component'` directive.

They are the opt-in end of the first-screen dial, the mirror of `<Background>` and `'background only'`. On a build whose main thread compiles no business code of its own (`enableMTSRendering: false`, which a root-level boundary turns on by itself), a root `<MainThread>` promotes one subtree back onto the first frame:

```tsx
root.render(
  <MainThread>
    <Shell />
  </MainThread>,
);
```

`Shell` — and everything it renders — is compiled for the main thread and runs there before the background exists, with working main-thread event handlers and worklets. A `<Background>` inside the island is folded to its fallback for the main thread, so the deferred subtree's code never reaches that bundle.

Because both threads render `children`, the first-screen hydration matches the background's render against the island the main thread already built and **adopts** it — the same hydration IFR runs, scoped to the island. The elements keep their identity and their event bindings, and a worklet context is hydrated in place rather than re-created, instead of the subtree being torn down and re-inserted.

A component that must be on the main thread even though nothing on the first-frame render path references it — one placed behind a `<Background>`, or resolved indirectly — declares that at its definition:

```tsx
export function Widget() {
  'main thread component';
  return <view>…</view>;
}
```

The build then compiles its module for the main thread regardless of who references it.
