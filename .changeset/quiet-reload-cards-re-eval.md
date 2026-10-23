---
"@lynx-js/react": minor
"@lynx-js/react-rsbuild-plugin": minor
"@lynx-js/react-webpack-plugin": minor
"@lynx-js/react-alias-rsbuild-plugin": minor
---

Add the experimental `experimental_reEvalJSOnReload` option. When it is enabled, `reloadTemplate` evaluates the main-thread and background entries again, so module-level state starts over while the native element tree is reused. It is disabled by default.

Re-evaluating the background entry requires `reloadCard` from the Lynx client. Without it, the background keeps the existing reload behavior.
