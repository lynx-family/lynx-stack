# @lynx-js/lynx-runtime

Lifecycle and event utilities for Vanilla Lynx applications.

The package initializes the main and background runtimes, tracks event
listeners, forwards lifetime destruction across threads, and provides typed
helpers for local and cross-thread communication. Element PAPI rendering stays
on the main thread, while business logic and asynchronous work stay on the
background thread.

The source is split by runtime responsibility:

- `common` contains shared runtime types and managed event channels.
- `main-thread` contains Engine lifecycle handling and the main-thread bridge.
- `background` contains background lifecycle handling and its bridge.

Main-thread initialization installs an identity `globalThis.processData`
fallback when the client has not provided one. Existing implementations are
preserved. Render and update payloads are passed directly from Engine lifecycle
events to the configured callbacks. Both thread initializers consume the Lynx
runtime's global `lynx` object directly.

## Main thread

```ts
import { initializeMainThread } from '@lynx-js/lynx-runtime/main-thread';

interface EventsToBackground {
  Increment: { amount: number };
}

interface EventsFromBackground {
  CounterUpdated: { count: number };
}

const runtime = initializeMainThread<
  EventsToBackground,
  EventsFromBackground
>({
  onRenderPage(data) {
    renderPage(data);
  },
  onUpdatePage(data) {
    updatePage(data);
  },
  onDestroy() {
    clearElementListeners();
  },
});

runtime.onBackgroundEvent('CounterUpdated', patch => {
  updatePage(patch);
});

runtime.dispatchToBackground('Increment', { amount: 1 });
```

## Background thread

```ts
import { initializeBackgroundThread } from '@lynx-js/lynx-runtime/background';

interface EventsToMain {
  CounterUpdated: { count: number };
}

interface EventsFromMain {
  Increment: { amount: number };
}

const runtime = initializeBackgroundThread<
  EventsToMain,
  EventsFromMain
>();

runtime.onMainThreadEvent('Increment', ({ amount }) => {
  count += amount;
  runtime.dispatchToMainThread('CounterUpdated', { count });
});
```

All cross-thread payloads must be small and serializable. Do not send functions
or Element PAPI node references.
