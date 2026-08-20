---
"@lynx-js/rsbuild-plugin": patch
---

Alias `@rspack/core/hot/log.js` and `@rspack/core/hot/log-apply-result.js`, which `@lynx-js/webpack-dev-transport` imports without declaring `@rspack/core`. Development builds failed to resolve them on any package manager that does not hoist `@rspack/core`, such as npm and Yarn.
