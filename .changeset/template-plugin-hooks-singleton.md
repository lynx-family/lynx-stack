---
"@lynx-js/template-webpack-plugin": patch
---

Make `LynxTemplatePlugin.getLynxTemplatePluginHooks` a cross-module singleton so duplicate copies of this package (e.g. from npm hoist conflicts) share the same hooks per compilation.
