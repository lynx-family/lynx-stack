---
"@lynx-js/rsbuild-plugin": patch
"@lynx-js/qrcode-rsbuild-plugin": patch
---

Fix `rspeedy preview` printing every bundle path twice, e.g. `http://192.168.1.1:3000/main/template.js/main/template.js`. With more than one entry the printed list became the cross product of every entry against every other entry.

Rsbuild renders one line per `(url, route)` pair as `url + route.pathname`, and the Lynx bundle routes are only in place for part of the server lifecycle: the dev server prints before `onAfterStartDevServer` fills them, the preview server prints after `onAfterStartPreviewServer`. `server.printUrls` now resolves the entry path itself only while the routes are still empty, so the path is applied exactly once either way.
