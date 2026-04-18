---
'@lynx-js/react-alias-rsbuild-plugin': patch
---

fix(rstest): add global fallback aliases for `@lynx-js/react/jsx-runtime` and `@lynx-js/react/jsx-dev-runtime`

`pluginReactAlias` only aliased these entries inside layer-specific rules (`issuerLayer: BACKGROUND/MAIN_THREAD`). In rstest mode there are no layers, so JSX transformed by the testing loader—which emits `import { jsx } from '@lynx-js/react/jsx-runtime'`—could not be resolved, causing a `Cannot find module '@lynx-js/react/jsx-runtime'` error. Added global (non-layer-specific) fallback aliases pointing to the background jsx-runtime.
