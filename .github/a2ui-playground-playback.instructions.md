---
applyTo: "packages/genui/a2ui-playground/**"
---

When wiring playback state between the Lynx app and the web preview in `packages/genui/a2ui-playground`, prefer `NativeModules.bridge.call('A2UI_PLAYBACK_SYNC', state, callback)` on the Lynx side and `lynxView.onNativeModulesCall` on the web preview side. Keep `window.postMessage` only as a compatibility fallback for older bundles, and do not add new playback sync paths that bypass the NativeModules bridge.
