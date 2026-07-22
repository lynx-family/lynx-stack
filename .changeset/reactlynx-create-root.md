---
"@lynx-js/react": patch
"@lynx-js/react-webpack-plugin": patch
"@lynx-js/react-rsbuild-plugin": patch
---

Support multiple pages sharing one background JS context, behind the `experimental_multiPageRoots` build option (`__MULTI_PAGE__` define, off by default).

Each page gets its own root with isolated render state and native channels. Pages keep using the classic `root.render`; a per-page glue call through `globalThis[Symbol.for('__REACTLYNX_BOOTSTRAP_PAGE__')]` binds the shared runtime to the loading page, with no exported API. Normal builds strip the whole mechanism.
