---
"@lynx-js/react-umd": patch
---

Build web-encoded `react-{dev,prod}.web.bundle` variants (via `EXTERNAL_BUNDLE_TARGET=web`), decodable by `@lynx-js/web-core` and exposed as the `./dev-web` and `./prod-web` exports, alongside the native `.lynx.bundle`.
