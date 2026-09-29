---
"@lynx-js/react": minor
"@lynx-js/react-rsbuild-plugin": minor
"@lynx-js/react-webpack-plugin": minor
"@lynx-js/react-signals": patch
"@lynx-js/chunk-loading-webpack-plugin": patch
"@lynx-js/react-refresh-webpack-plugin": patch
---

Support sharing the ReactLynx runtime and state through split chunks across the cards of a LynxGroup, behind `experimental_lynxGroupModuleSharing`, with `useLynx()` and `createRoot(lynx)` from `@lynx-js/react/internal`. Not available with `experimental_useElementTemplate` yet.
