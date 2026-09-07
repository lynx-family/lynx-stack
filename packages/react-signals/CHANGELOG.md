# @lynx-js/react-signals

## 0.0.3

### Patch Changes

- Accept `@lynx-js/react` 0.126, which ships Preact 11. ([#3450](https://github.com/lynx-family/lynx-stack/pull/3450))

## 0.0.2

### Patch Changes

- Widen the `@lynx-js/react` peer dependency range to include 0.125. ([#3551](https://github.com/lynx-family/lynx-stack/pull/3551))

## 0.0.1

### Patch Changes

- Register the snapshot and worklet definitions collected from the background build on the main thread, so a definition the main-thread bundle dropped no longer fails with `Snapshot not found`. ([#3393](https://github.com/lynx-family/lynx-stack/pull/3393))

- Add `@lynx-js/react-signals`, a thread-aware Preact Signals adapter that keeps Signals dependencies out of `@lynx-js/react`. Signal reactivity runs on the background thread, while main-thread rendering uses static signal values with inactive setters, subscriptions, and effects. ([#3346](https://github.com/lynx-family/lynx-stack/pull/3346))
