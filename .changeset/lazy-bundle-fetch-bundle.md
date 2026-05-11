---
"@lynx-js/react": patch
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/react-webpack-plugin": patch
"@lynx-js/react-transform": patch
"@lynx-js/template-webpack-plugin": patch
---

feat(lazy-bundle): add `lynx.fetchBundle`-based loader

Opt in by setting `engineVersion: '3.8'` (or higher) in `pluginReactLynx`.
Use `import('./X', { with: { mode: 'sync' | 'async' } })` to control whether
the first screen blocks on a sync fetch. The lazy bundle's main-thread
section is bytecoded by default (skipped in dev or when `DEBUG` includes
`rspeedy`).
