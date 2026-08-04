---
"@lynx-js/react": patch
"@lynx-js/react-webpack-plugin": patch
"@lynx-js/react-rsbuild-plugin": patch
---

Add main-thread islands: `<MainThread>` and the `'main thread component'` directive.

They are the opt-in end of the first-screen dial, the mirror of `<Background>` and `'background only'`. On a build whose main thread renders nothing (`enableMTSRendering: false`, which a root-level boundary turns on by itself), a root `<MainThread>` promotes one subtree back onto the first frame:

```tsx
root.render(
  <MainThread fallback={<view className='skeleton' />}>
    <Shell />
  </MainThread>,
);
```

```tsx
// Shell.tsx — compiled into the main-thread bundle, unlike the rest of the app
export function Shell() {
  'main thread component';
  return (
    <view>
      <Header />
      <Background fallback={<FeedSkeleton />}>
        <Feed />
      </Background>
    </view>
  );
}
```

Because both threads render the island, the first-screen hydration matches the background's render against the instances the main thread already built and **adopts** them — the same hydration IFR runs, scoped to the island. The elements keep their identity and their event bindings, and a worklet context is hydrated in place rather than re-created, instead of the subtree being torn down and re-inserted.

If the island does not make it into the main-thread bundle, the boundary's static `fallback` paints instead and the handover degrades to the ordinary full insert; the build says why.
