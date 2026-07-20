---
"@lynx-js/react-umd": patch
"@lynx-js/external-bundle-rsbuild-plugin": patch
---

Ship the refresh runtime in the shared external bundle so it is loaded once instead of per card.

`@lynx-js/react/refresh` was missing from both the `react-umd` entry and the `reactlynx` externals preset, so every card bundled its own copy. Each copy overwrites `options.debounceRendering` on the _shared_ ReactLynx runtime with a closure that defers through that card's own `Promise`. The last card loaded wins, and once it is destroyed its microtask queue stops draining — the lost flush leaves Preact's scheduling counter set, so no card in the shared context ever re-renders again.

Only the development bundle carries it; the production bundle is unchanged in size.
