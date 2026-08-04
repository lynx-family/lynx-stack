---
"@lynx-js/react": patch
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/react-webpack-plugin": patch
---

Add the experimental `experimental_transformBuiltinAttributeNames` option for transforming builtin element attribute names. `false` preserves attribute names. `true` transforms `onClick` to `bindtap`, `onCatchTap` to `catchtap`, other `onXXX` event names to `bindxxx`, and remaining camelCase names to dash-case. An object supports serializable custom rules through `mode`, `preserve`, and `rename`. Explicit JSX attributes are transformed during compilation, and spread attributes are transformed at runtime.
