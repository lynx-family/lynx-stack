---
"@lynx-js/react-webpack-plugin": patch
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/react": patch
---

When engineVersion is greater than or equal to 3.1, use `__SetAttribute` to set text attribute for text node instead of creating a raw text node.
