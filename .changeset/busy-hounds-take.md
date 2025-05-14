---
"@lynx-js/web-mainthread-apis": patch
"@lynx-js/web-worker-runtime": patch
"@lynx-js/web-core": patch
---

feat: allow lynx code to get JS engine provided properties on globalThis

```
globalThis.Reflect; // this will be the Reflect Object
```

Note that `assigning to the globalThis` is still not allowed.
