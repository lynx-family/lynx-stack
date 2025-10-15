---
"@lynx-js/web-core": patch
"@lynx-js/web-mainthread-apis": patch
---

fix: mts freeze after reload()

The mts may be freezed after reload() called.

We fixed it by waiting until the all-on-ui Javascript realm implementation, an iframe, to be fully loaded.
