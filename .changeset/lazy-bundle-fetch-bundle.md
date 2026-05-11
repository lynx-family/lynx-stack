---
"@lynx-js/react": minor
"@lynx-js/react-rsbuild-plugin": minor
"@lynx-js/react-webpack-plugin": minor
"@lynx-js/template-webpack-plugin": minor
---

feat(lazy-bundle): add `lynx.fetchBundle`-based loader

Opt in by setting `engineVersion: '3.8'` (or higher) in `pluginReactLynx`.
Use `import('./X', { with: { mode: 'sync' | 'async' } })` to control whether
the first screen blocks on a sync fetch. The lazy bundle's main-thread
section is bytecoded by default (skipped in dev or when `DEBUG` includes
`rspeedy`).
