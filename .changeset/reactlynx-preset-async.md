---
"@lynx-js/external-bundle-rsbuild-plugin": minor
---

The `reactlynx` externals preset accepts `{ async: true }`, mounting ReactLynx as an awaited promise so async runtimes can load it via `fetchBundle().then` (the sync array form reads `React.memo` etc. off a pending promise and gets `undefined`). Externals presets resolve per environment (`environmentName` is available in the preset context): `lynx` / `lynx-*` environments use `react.lynx.bundle`, other environments (e.g. `web`) use the web-encoded `@lynx-js/react-umd/{dev,prod}-web` `react.web.bundle` — `async` only controls the mount form.
