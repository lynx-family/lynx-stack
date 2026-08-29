---
"@lynx-js/template-webpack-plugin": minor
---

Generalize how `LynxTemplatePlugin` emits custom sections. The section names are resolved through a `CustomSectionNaming` strategy instead of being fixed to the three lazy bundle constants, and every main-thread and CSS asset is considered rather than only the first one. A name of `undefined` keeps an asset out of the sections, which is how a lazy bundle keeps its non-entry background chunks in the manifest. The lazy bundle output is unchanged.
