---
"@lynx-js/react-refresh-webpack-plugin": patch
---

Release the `@lynx-js/react-webpack-plugin` peer range bump from #2423 (extending the upper bound to `^0.9.0`). Without this entry the peer-range fix sat on `main` but never reached a published version, so npm-resolved installs continued to pull `@lynx-js/react-webpack-plugin@0.8.0` alongside newer `^0.9.0` consumers and triggered duplicate physical copies of `@lynx-js/template-webpack-plugin` under `node_modules`.
