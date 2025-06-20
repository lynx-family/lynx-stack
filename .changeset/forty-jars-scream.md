---
"@lynx-js/web-mainthread-apis": patch
"@lynx-js/web-core-server": patch
"@lynx-js/web-constants": patch
"@lynx-js/web-core": patch
---

feat: add `_SetSourceMapRelease(errInfo)` MTS API.

You can get `errInfo.release` through `e.detail.release` in the error event callback of lynx-view.

The `_SetSourceMapRelease` function is not complete yet, because it is currently limited by the Web platform and some functions and some props such as `err.stack` do not need to be supported for the time being.
