---
"@lynx-js/rsbuild-plugin": patch
"@lynx-js/qrcode-rsbuild-plugin": patch
---

Fix `rspeedy preview` printing every bundle path twice, e.g. `http://192.168.1.1:3000/main/template.js/main/template.js`. With more than one entry the printed list became the cross product of every entry against every other entry.

Rsbuild renders one line per `(url, route)` pair as `url + route.pathname`. Since Lynx bundle routes were added, `server.printUrls` must return the base URL and let the routes supply the per-entry part — returning fully resolved bundle URLs applied the entry path a second time. The web preview and `?fullscreen=true` links are now contributed as routes as well.
