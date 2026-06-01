---
applyTo: "packages/genui/a2ui-playground/**"
---

When wiring playback state between the Lynx app and the web preview in `packages/genui/a2ui-playground`, prefer `NativeModules.bridge.call('A2UI_PLAYBACK_SYNC', state, callback)` on the Lynx side and `lynxView.onNativeModulesCall` on the web preview side. Keep `window.postMessage` only as a compatibility fallback for older bundles, and do not add new playback sync paths that bypass the NativeModules bridge.

When serving the playground's native Lynx bundles as static Android test fixtures, keep HMR/React refresh out of `a2ui.lynx.js` and `openui.lynx.js`. The Android Lynx runtime does not provide globals such as `__prefresh_utils__` or Node's `process`, so normalize `process.env.NODE_ENV` at build time and disable HMR for these bundles instead of relying on the caller's `NODE_ENV`.
