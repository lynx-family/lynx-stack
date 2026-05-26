---
"@lynx-js/testing-environment": minor
---

Export `GlobalEventEmitter` as a public API and document the setup hooks (`onInjectBackgroundThreadGlobals`, `onInjectMainThreadGlobals`, `onSwitchedToBackgroundThread`, `onSwitchedToMainThread`, `onResetLynxTestingEnv`, `onInitWorkletRuntime`) to make `@lynx-js/testing-environment` a documented, first-class foundation for building framework-specific testing libraries.
