---
"@lynx-js/react-refresh-webpack-plugin": patch
---

Fix `isComponent is not a function` crashing the HMR runtime when ReactLynx is consumed as an async external bundle.

The refresh helpers were injected via `ProvidePlugin`, whose dependency edge does not participate in async-module handling, so `@lynx-js/react/refresh` resolved to a pending Promise and `isComponent`/`flush` were `undefined`. They now ship as an ESM module (`runtime/refresh.mjs`) injected by the loader as a real import, awaited through the normal async-module machinery.
