---
"@lynx-js/web-mainthread-apis": patch
"@lynx-js/offscreen-document": patch
"@lynx-js/web-worker-runtime": patch
"@lynx-js/template-webpack-plugin": patch
"@lynx-js/web-core-server": patch
"@lynx-js/web-constants": patch
"@lynx-js/web-core": patch
---

refactor: code clean

rename many internal apis to make logic be clear:

multi-thread: startMainWorker -> prepareMainThreadAPIs -> startMainThread -> createMainThreadContext(new MainThreadRuntime)
all-on-ui: prepareMainThreadAPIs -> startMainThread -> createMainThreadContext(new MainThreadRuntime)
