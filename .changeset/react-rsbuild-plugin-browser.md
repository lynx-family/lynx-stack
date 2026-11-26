---
"@lynx-js/react-rsbuild-plugin": patch
---

Set up `pluginReactLynx` without Node.js `require`, so it can run in the browser through `@rspack/browser`. It reads its own `package.json` with `fs` for a debug log, and skips the log when the file is not available. The log now names `@lynx-js/react-rsbuild-plugin`, whose version it reports, and no longer resolves the path of `@lynx-js/react-webpack-plugin`.
