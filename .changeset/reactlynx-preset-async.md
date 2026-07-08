---
"@lynx-js/external-bundle-rsbuild-plugin": minor
---

The `reactlynx` externals preset accepts `{ async: true }`. It resolves the web-encoded `@lynx-js/react-umd/{dev,prod}-web` bundle and mounts ReactLynx as an awaited promise, so the web runtime can load it via `fetchBundle().then` (the sync array form reads `React.memo` etc. off a pending promise and gets `undefined`).
