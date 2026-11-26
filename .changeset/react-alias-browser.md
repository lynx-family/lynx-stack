---
"@lynx-js/react-alias-rsbuild-plugin": patch
---

Resolve `@lynx-js/react/package.json` with Rspack's resolver and read it with `fs` instead of Node.js `require`, so `pluginReactAlias` can run in the browser through `@rspack/browser`, where both see the in-memory file system.
