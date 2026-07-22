---
"@lynx-js/react": patch
"@lynx-js/react-webpack-plugin": patch
"@lynx-js/react-rsbuild-plugin": patch
---

Support multiple pages sharing one background JS context, behind the `experimental_multiPageRoots` build option (`__MULTI_PAGE__` define, off by default).

Each page gets its own root with isolated render state and native channels. Pages keep using the classic `root.render`; a per-page glue call (`root.__experimentalBootstrapPage?.(...)`, installed on `root` only in multi-page builds) binds the shared runtime to the loading page, with no new exported API. Normal builds strip the whole mechanism.
