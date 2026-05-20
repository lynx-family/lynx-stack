---
"@lynx-js/externals-loading-webpack-plugin": minor
"@lynx-js/external-bundle-rsbuild-plugin": minor
---

feat: support retrying fetchBundle on timeout (response code -2)

Add a new `retries` option to both `ExternalsLoadingPlugin` and `pluginExternalBundle`, alongside the existing `timeout` option. When the runtime helpers detect a fetch timeout (`response.code === -2`), they retry up to `retries` additional times before rejecting/throwing. Can be set per-external (overrides the plugin-level option) or at the plugin level. Defaults to `0` (no retries), so the behavior is backward-compatible.
