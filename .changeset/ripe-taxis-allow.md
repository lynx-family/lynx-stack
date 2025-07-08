---
"@lynx-js/web-core": patch
---

feat: lynx-view error event adds a new parameter: `e.detail.fileName`, which will be determined by the file location where the error occurred, either `lepus.js` or `app-service.js`.
