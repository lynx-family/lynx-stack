---
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/react-alias-rsbuild-plugin": patch
---

Expose versioned semantic React compilation results through `Symbol.for('@lynx-js/react/internal:compile-result')`. Consumers can read main-thread programmability requirements from Stats or MultiStats without inspecting filenames. Missing or incompatible compilation results remain unknown rather than becoming an explicit false result.
