---
"@lynx-js/react": minor
"@lynx-js/react-rsbuild-plugin": minor
"@lynx-js/react-webpack-plugin": minor
"@lynx-js/template-webpack-plugin": minor
"@lynx-js/runtime-wrapper-webpack-plugin": minor
---

Add the experimental `experimental_reEvalJSOnReload` option to reset module-level state when a ReactLynx page is reused through `reloadTemplate`.

When enabled, ReactLynx re-evaluates the main-thread and background entries, including loaded lazy bundles. Snapshot reuses the existing native element tree; Element Template retains the native page root and rebuilds its children. Each reload initializes a fresh runtime and prevents pending cleanup or updates from the previous runtime from affecting the new page.

Background entry re-evaluation requires Lynx core support for `app.reloadCard`. Older cores retain the existing background reload behavior. The option is disabled by default.
