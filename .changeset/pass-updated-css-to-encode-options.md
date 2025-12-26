---
"@lynx-js/template-webpack-plugin": patch
---

fix: pass updated css from encodeData to resolvedEncodeOptions

Previously, the initial CSS was used in resolvedEncodeOptions instead of the potentially updated CSS from encodeData after the beforeEncode hook. This fix ensures resolvedEncodeOptions receives the latest CSS data.
