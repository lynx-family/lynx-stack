---
"@lynx-js/react": patch
---

Document and guarantee the compile-time separation of a `<Background>` subtree.

By default `<Background>` is a runtime opt-out — the deferred subtree's code is still bundled into the main thread, it just does not run there. Authoring the deferred component with the `'background only'` directive now also keeps its render logic out of the main-thread bundle, so no side effect can leak onto the main thread, while its element and main-thread-script (worklet) definitions — which the first-screen hydration needs to build the real content — are retained:

```tsx
// Feed.tsx
export function Feed() {
  'background only';
  // hooks, effects, event handlers, data formatting — none of this reaches the main-thread bundle
  return <view>...</view>
}

// App.tsx
<Background fallback={<FeedSkeleton />}>
  <Feed />
</Background>
```

This composition ("strip render logic, keep snapshot + worklet definitions") is verified cross-module against the real bundle. It falls out of the existing transform pass order (worklet/snapshot extraction runs before the directive strip, so the definitions are hoisted to module scope before the component body is emptied) and the boundary keeping the component reference (so its module — and its definitions — stay in the main-thread bundle).
