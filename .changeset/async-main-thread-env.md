---
"@lynx-js/cache-events-webpack-plugin": patch
---

Initialize main-thread `SystemInfo` and `NativeModules` compatibility globals before async entry dependencies execute. This allows ordinary modules to access these globals while an external ReactLynx bundle is still loading, without changing the background thread's native bridge.
