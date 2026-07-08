---
"@lynx-js/react": minor
"@lynx-js/react-rsbuild-plugin": minor
"@lynx-js/react-webpack-plugin": minor
"@lynx-js/template-webpack-plugin": minor
"@lynx-js/chunk-loading-webpack-plugin": patch
"@lynx-js/webpack-runtime-globals": patch
"@lynx-js/react-refresh-webpack-plugin": patch
"@lynx-js/css-extract-webpack-plugin": patch
---

feat(lazy-bundle): add `lynx.fetchBundle`-based loader

Opt in by setting `engineVersion: '3.8'` (or higher) in `pluginReactLynx`.
Use `import('./Foo.jsx', { with: { mode: 'sync' | 'async' } })` to control whether
the first screen blocks on a sync fetch. The lazy bundle's main-thread
section is bytecoded by default (skipped in dev or when `DEBUG` includes
`rspeedy`).

To override the loader regardless of `engineVersion`, set the
`REACT_LAZY_BUNDLE_FETCHER` env var: `QueryComponent` forces the legacy
loader, `FetchBundle` forces the new one (which still requires
`engineVersion >= 3.8`, otherwise the build errors). Leave it unset to let
`engineVersion` decide.

Importing the same lazy bundle with conflicting `mode`s (e.g. `'sync'` at one
site and `'async'` at another) now fails the build with an error listing every
conflicting `import()` site, since a single bundle can only load one way. Until
the conflict is resolved the bundle falls back to `mode: 'async'`.
