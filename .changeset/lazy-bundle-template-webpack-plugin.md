---
"@lynx-js/template-webpack-plugin": minor
---

feat(lazy-bundle): emit FetchBundle async chunks and guard conflicting modes

Encode async lazy-bundle chunks with `customSections` (main-thread / background /
CSS) for the `fetchBundle` loader, and emit a per-chunk `mode` map (empty maps
are skipped so no invalid `undefined = {}` is generated). Importing the same
bundle with conflicting `sync`/`async` modes now fails the build with one error
per bundle, naming the import request and the importing modules, and falls back
to `mode: 'async'` until fixed.
