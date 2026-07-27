---
applyTo: "packages/web-platform/web-core/ts/client/{background/background-apis/createNativeApp.ts,mainthread/{Background.ts,LynxViewInstance.ts}},packages/web-platform/web-core/tests/create-native-app.spec.ts"
---

For background `queryComponent`, do not use `templateCache` to decide callback readiness. Always wait for the main-thread `queryComponent` RPC and forward its `{ code, detail }` response, because that promise covers loading the main-thread chunk and running `processEvalResult`. Keep `templateCache` only for resolving background chunk URLs in `readScript`, `loadScript`, and `loadScriptAsync`.
