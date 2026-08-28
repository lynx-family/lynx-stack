---
"@lynx-js/rspeedy": minor
"@lynx-js/rsbuild-plugin": minor
---

**BREAKING CHANGE**: Remove `dev.client`. `websocketTransport` predates `LynxWebSocketModule`, the native module Lynx has shipped since 2.16, so HMR always resolves `@lynx-js/websocket` — the binding to it.
