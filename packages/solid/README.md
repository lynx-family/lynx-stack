# `@lynx-js/solid`

SolidJS renderer and runtime adapter for Lynx.

Solid reconciliation and signal updates run on the background thread. The main
thread receives serializable Element Template commands and applies them through
Element PAPI.

Use this package with `@lynx-js/solid-rsbuild-plugin`; application code should
use one entry rather than separate main-thread and background-thread sources.
The plugin reuses Solid's DOM compiler, extracts each static element fragment
into Lynx Element Template metadata, and replaces the generated web
`template()` call with this package's `createTemplate()` runtime helper.

```tsx
import { createSignal, root } from '@lynx-js/solid';

function App() {
  const [count, setCount] = createSignal(0);

  return (
    <view bindtap={() => setCount(value => value + 1)}>
      <text>{count()}</text>
    </view>
  );
}

root.render(App);
```

Normal `bind*` and `catch*` handlers are dispatched back to the background
thread, where they can update Solid signals.
