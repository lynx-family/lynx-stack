---
applyTo: "packages/react-signals/**"
---

Keep Preact Signals dependencies and the public Signals adapter in `@lynx-js/react-signals`; do not add `@preact/signals` or `@preact/signals-core` to `@lynx-js/react`. Keep the root entry aligned with the upstream Preact Signals API and the `lepus` entry self-contained apart from ReactLynx main-thread hooks. The main-thread implementation must expose static first-screen values: setters may report a development error but must not mutate, and effects or subscriptions must not execute callbacks.
