---
"@lynx-js/rspeedy": minor
---

Upgrade the built-in Rsdoctor to the optional `@rsdoctor/core@2.0.0-beta.1` dependency. Rspeedy keeps its existing Node.js support; automatic Rsdoctor 2.0 integration requires Node.js 22.18 or later. On older supported Node.js versions, install `@rsdoctor/rspack-plugin@1` and register it through `tools.rspack` with `supports.banner: true`. Manually registered plugins are preserved, and missing optional dependencies produce installation guidance only when automatic analysis is requested.

Remove `tools.rsdoctor.experiments.enableNativePlugin`; native graph collection is always enabled in Rsdoctor 2.0. The built-in configuration types remain available when optional dependencies are omitted.
