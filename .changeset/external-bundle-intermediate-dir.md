---
"@lynx-js/lynx-bundle-rslib-config": patch
---

Route the raw per-thread chunks and debug intermediates of an external bundle into `.lynx/<id>/`, the way a page build's are routed into `.lynx/<entry>/`, instead of the flat `[name].js` default. A `development` build (or `DEBUG` set) used to leave them next to the bundle at the root of `dist`.
