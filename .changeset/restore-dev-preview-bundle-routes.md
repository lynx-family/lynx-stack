---
"@lynx-js/rsbuild-plugin": patch
---

Restore populating Lynx bundle routes in `onAfterStartDevServer` and `onAfterStartPreviewServer` while preventing `server.printUrls` from repeating the bundle path.
