---
"@lynx-js/rsbuild-plugin": patch
"@lynx-js/qrcode-rsbuild-plugin": patch
---

Stop `rspeedy preview` from repeating the bundle path in the URLs it prints. The bundle path is now resolved once, in `server.printUrls`, instead of being written into the server routes that Rsbuild appends to every printed URL.
