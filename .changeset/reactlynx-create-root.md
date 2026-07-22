---
"@lynx-js/react": patch
"@lynx-js/react-webpack-plugin": patch
"@lynx-js/react-rsbuild-plugin": patch
---

Support multiple cards sharing one background JS context, behind the `experimental_multiCardRoots` build option (`__MULTI_CARD__` define, off by default).

Each card gets its own root with isolated render state and native channels. Cards keep using the classic `root.render`; a per-card glue call (`__experimentalBootstrapCard` from `@lynx-js/react/internal`) binds the shared runtime to the loading card. Normal builds strip the whole mechanism.
