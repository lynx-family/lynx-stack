---
"@lynx-js/react": minor
---

Add the `lynx.fetchBundle`-based lazy bundle loader. Control whether the first
screen blocks on the fetch with the `mode` import attribute:

```js
import('./Foo.jsx', { with: { mode: 'sync' } }); // block the first screen
import('./Foo.jsx', { with: { mode: 'async' } }); // default, non-blocking
```

Enable it by setting `engineVersion: '3.8'` (or higher) in `pluginReactLynx`. The
lazy bundle's main-thread section is bytecoded by default (skipped in dev or when
`DEBUG` includes `rspeedy`).
