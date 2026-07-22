---
applyTo: "packages/web-platform/web-core/ts/client/{background,mainthread}/**,packages/web-platform/web-core/ts/client/endpoints.ts"
---

Keep the Web devtool event bridge per `LynxViewInstance` by routing it through that instance's `BackgroundThread` RPC. Preserve the native context-proxy shape on BTS: `lynx.getDevtool().dispatchEvent({ type, data })` emits a `devtoolMessage` `CustomEvent` whose `detail` is the full `{ type, data }` object, while `lynxView.sendDevtoolEvent(type, data)` reaches listeners registered with `lynx.getDevtool().addEventListener(type, listener)`.
