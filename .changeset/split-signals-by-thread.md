---
"@lynx-js/react-signals": patch
"@lynx-js/react-alias-rsbuild-plugin": patch
"@lynx-js/genui": patch
---

Add `@lynx-js/react-signals`, a thread-aware Preact Signals adapter that keeps Signals dependencies out of `@lynx-js/react`. Signal reactivity runs on the background thread, while main-thread rendering uses static signal values with inactive setters, subscriptions, and effects.
