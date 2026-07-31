# `@lynx-js/react-signals`

Thread-aware Preact Signals integration for ReactLynx.

```tsx
import { signal, useSignal } from '@lynx-js/react-signals';
```

The ReactLynx build keeps Signals reactive on the background thread and uses
static values during main-thread first-screen rendering.
