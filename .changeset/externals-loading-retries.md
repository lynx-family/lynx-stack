---
"@lynx-js/externals-loading-webpack-plugin": minor
"@lynx-js/external-bundle-rsbuild-plugin": minor
---

feat: support retrying fetchBundle on timeout (response code -2)

Add a new `retries` option to both `ExternalsLoadingPlugin` and `pluginExternalBundle`, alongside the existing `timeout` option. When the runtime helpers detect a fetch timeout (`response.code === -2`), they retry up to `retries` additional times before rejecting/throwing. Retries are coordinated per bundle URL: when multiple externals share the same URL but configure different `retries` values, the maximum is used, and one retry chain is shared across all consumers (both sync and async). The option can be configured per-external or at the plugin level, and defaults to `0` (no retries), so the behavior is backward-compatible.
