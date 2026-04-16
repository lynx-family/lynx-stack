---
'@lynx-js/externals-loading-webpack-plugin': patch
---

fix: deduplicate `loadScript` calls for externals sharing the same (bundle, section) pair

When multiple externals had different `libraryName` values but pointed to the same
bundle URL and section path, `createLoadExternalSync`/`createLoadExternalAsync` was
called once per external, causing `lynx.loadScript` to execute redundantly for the
same section. Now only the first external in each `(url, sectionPath)` group triggers
the load; subsequent externals in the group are assigned the already-loaded result
directly.
