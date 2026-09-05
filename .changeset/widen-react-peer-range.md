---
"@lynx-js/react-signals": patch
"@lynx-js/react-rsbuild-plugin": patch
---

Accept `@lynx-js/react@^0.126.0` in the peer range. The new minor carries
`createRenderContext`, which neither package uses, so the older ranges stay
supported.
