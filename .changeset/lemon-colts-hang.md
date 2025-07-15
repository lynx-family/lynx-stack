---
"@lynx-js/web-mainthread-apis": patch
"@lynx-js/web-core-server": patch
"@lynx-js/web-constants": patch
"@lynx-js/web-core": patch
---

feat: move SSR hydrate essential info to the ssr attribute

We found that in browser there is no simple tool to decode a base64 string

Therefore we move the data to `ssr` attribute

Also fix some ssr issues
