---
"@lynx-js/react": patch
"@lynx-js/react-webpack-plugin": patch
"@lynx-js/react-rsbuild-plugin": patch
---

Add main-thread islands: `<MainThread>` and the `'main thread component'` directive.

They are the opt-in end of the first-screen dial, where `<Background>` and `'background only'` are the opt-out end. On a build whose main thread compiles no business code of its own (`experimental_enableMTSRendering: false`, which a root-level boundary turns on by itself), a root `<MainThread>` promotes one subtree back onto the first frame:

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

For first-screen content _inside_ a deferred region, name it on the boundary rather than reaching for a `<MainThread>` in its `children` — the main thread never runs `children`, so a boundary declared in there sits at a position it cannot know:

```tsx
<Background island={<Nav />} fallback={<FeedSkeleton />}>
  <Feed />
</Background>;
```

Both threads render the island ahead of their own arm — `[island, fallback]` on the main thread, `[island, children]` on the background — so it is at the same index in both trees and the first-screen hydration adopts it while replacing only the fallback.

The three shapes are one primitive with one axis: how much of a boundary's two arms is shared. Sharing nothing is a plain `<Background fallback={…}>`, and the hand-over replaces everything; sharing a prefix is `island`, and the hand-over adopts that prefix; sharing everything is `<MainThread>`, which is why `<MainThread>{i}</MainThread>` and `<Background fallback={i}>{i}</Background>` render the same frames.
