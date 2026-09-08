---
applyTo: "packages/rspeedy/core/**"
---

Keep `@rsdoctor/core` optional and the public options type independent of it. Compare the local options against upstream types in type tests. When `RSDOCTOR=true`, exclude configs with a manually registered plugin before checking Node.js >=22.18 or loading Rsdoctor 2.0. Older supported Node versions can use a manually registered Rsdoctor 1.x plugin. Preserve `supports.banner: true` for Lynx runtime wrappers. Do not reintroduce `experiments.enableNativePlugin` for the built-in plugin.

Rspeedy tests may overwrite the package’s `dist` directory. Rebuild through Turbo after tests before packing the package for installation smoke tests.
