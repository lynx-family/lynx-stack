---
"@lynx-js/rsbuild-plugin": patch
---

Add `pluginLynx({ dev: { client: { websocketTransport } } })` for the module that provides the `WebSocket` used by HMR. It takes precedence over the one Rspeedy tunnels through the Rsbuild config.
