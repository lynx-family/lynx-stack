---
"@lynx-js/web-core": patch
---

Render main-only Lynx XML cards without requesting a missing `app-service.js`
by registering an empty background entry when the optional background script
is omitted.
