---
"@lynx-js/rsbuild-plugin": patch
"@lynx-js/rspeedy": patch
---

Write the bundle to disk during `dev` by default. A Lynx client reads it from disk as often as it reads it from the dev server, so the Lynx build engine now carries the default that only Rspeedy used to apply.
