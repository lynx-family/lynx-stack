---
"@lynx-js/web-core": patch
---

Fix `nativeApp.callLepusMethod` always invoking its callback with `undefined`: the UI-thread handler now returns the lepus method's result so the callback receives it.
