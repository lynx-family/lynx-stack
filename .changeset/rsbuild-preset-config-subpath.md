---
"@lynx-js/preset-rsbuild-plugin": patch
---

Move the granular Lynx config sub-types (`Output`, `Source`, `Dev`, `Performance`, `Resolve`, `Server`, `Tools`, `Filename`, `CssModules`, …) from the main entry to the `@lynx-js/preset-rsbuild-plugin/config` subpath.

The top-level entry now keeps only the surface most consumers need — `pluginLynxPreset`, `loadLynxConfig`, `Config`, `ExposedAPI`, `mergeRspeedyConfig`, `defineConfig`. The leaf types are all reachable through `Config` (e.g. `Config['output']`) and are re-exported unchanged by `@lynx-js/rspeedy`, so `import { Output } from '@lynx-js/rspeedy'` keeps working.
