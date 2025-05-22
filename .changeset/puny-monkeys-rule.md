---
"@lynx-js/template-webpack-plugin": patch
---

feat: Merge the absent configurations for `.web.bundle`.

Before this change, the configuration of pageConfig in `.web.bundle` was `compilerOptions`. After this commit, pageConfig will be a combination of `compilerOptions` and `sourceContent.config`.
