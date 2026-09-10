# `@lynx-js/react-signals`

Thread-aware [Preact Signals](https://preactjs.com/blog/introducing-signals/)
integration for ReactLynx.

```tsx
import { signal, useSignal } from '@lynx-js/react-signals';
```

The ReactLynx build keeps Signals reactive on the background thread and uses
static values during main-thread first-screen rendering.

## Reading Signals in JSX

ReactLynx does not currently support consuming a `Signal` directly in JSX. Read
its value through `.value` instead:

```tsx
<text>Value: {count.value}</text>;
```

Reading `signal.value` while rendering a component subscribes that component to
the Signal. When the value changes, the subscribed component re-renders.
