---
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/react-webpack-plugin": patch
"@lynx-js/react": patch
---

Add the experimental `experimental_reloadEntryReeval` option. When enabled, the main thread entry is wrapped by the bundler and re-evaluated on `reloadTemplate` instead of reusing the JSX of the previous render, so module scoped state of the entry is reset while the element tree is still reused. `@lynx-js/react` must be external, otherwise the re-run replaces the framework's own root and snapshot registry.
