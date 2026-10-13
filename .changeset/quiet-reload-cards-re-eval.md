---
"@lynx-js/react": minor
"@lynx-js/react-rsbuild-plugin": minor
"@lynx-js/react-webpack-plugin": minor
"@lynx-js/template-webpack-plugin": minor
"@lynx-js/runtime-wrapper-webpack-plugin": minor
---

Add the experimental `experimental_reEvalJSOnReload` option to re-evaluate the ReactLynx entry on `reloadTemplate` while reusing the existing element tree.

Invalidate main-thread external exports before re-evaluating the entry so reload initializes a fresh runtime while preserving the existing element tree.

Clear the previous background root's stored JSX during experimental reload so queued global props updates cannot remount components or invoke stale refs.
