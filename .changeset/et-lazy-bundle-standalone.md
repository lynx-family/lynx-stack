---
"@lynx-js/react-webpack-plugin": patch
---

fix(react): scope Element Template collection to the encoded bundle

When `experimental_useElementTemplate` is enabled, element templates were
collected from every module in the compilation for each bundle's encode, so a
dynamic component's template was duplicated into the main bundle (and into every
other bundle). Collection is now scoped to the modules of the bundle being
encoded — resolved from `entryNames` via the bundle's chunk group — so each
bundle keeps only its own templates.

Adds a `react-et-lazy-bundle-standalone` example covering Element Template
standalone lazy bundles built with a separate producer build.
