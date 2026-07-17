---
"@lynx-js/react": minor
---

Add the `<Background>` component, a first-screen boundary that opts a subtree out of the main-thread first-screen render (IFR, Instant First-Frame Rendering).

During the main-thread first-screen render, the boundary renders `fallback` (or nothing) instead of `children`. The background thread always renders `children`, and the first-screen hydration replaces the fallback with the real content through the normal update patch.

```tsx
import { Background } from '@lynx-js/react';

function ProfilePage() {
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

Use it for subtrees that cannot, or should not, participate in the first-screen render — for example when their first-screen data is only available asynchronously, or when they rely on background-thread-only capabilities.

Keep the `fallback` static: event handlers and refs inside the fallback are never attached, because the fallback only ever exists on the main thread and is removed when hydration completes. Note that `<Background>` is not a performance optimization by itself — the background thread still renders the full tree, and the boundary content is inserted after hydration, which may cause layout shift unless the fallback preserves the layout of `children`.
