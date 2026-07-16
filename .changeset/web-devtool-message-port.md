---
"@lynx-js/web-core": minor
---

Add a per-card devtool message channel — the web counterpart of the native Lynx devtool pipe.

Each `lynx-view` now transfers a dedicated `MessagePort` into its background worker, exposed to the card as `lynx.getDevtool()` with the native API shape (`dispatchEvent` / `addEventListener` over `{ type, data }` events). The hosting page's end is available as `lynxView.devtoolMessagePort`. Devtools clients written against native Lynx (e.g. `@lynx-js/preact-devtools`) work unchanged, and the point-to-point port avoids the cross-tab/cross-view interference of origin-wide transports such as `BroadcastChannel`.
