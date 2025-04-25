---
"@lynx-js/web-mainthread-apis": patch
"@lynx-js/web-worker-runtime": patch
"@lynx-js/web-constants": patch
"@lynx-js/web-core": patch
---

refactor: isolate SystemInfo

Never assign `SystemInfo` on worker's self object.
