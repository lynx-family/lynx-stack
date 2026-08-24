---
"@lynx-js/react": patch
"@lynx-js/cache-events-webpack-plugin": patch
"@lynx-js/testing-environment": patch
---

Reach lynx-core's app object through `lynx.getApp()` instead of the
`lynxCoreInject` global the AMD wrapper injects. It is the same instance, so
behavior is unchanged, and resolving it through `lynx` also stays correct once
several cards share a runtime chunk. `@lynx-js/testing-environment` now exposes
`lynx.getApp()` alongside the object it already provided.
