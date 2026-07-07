---
"@lynx-js/web-core": patch
---

Break a circular dependency in the web-core main thread runtime by using `import type` for type-only `LynxViewInstance` imports.
