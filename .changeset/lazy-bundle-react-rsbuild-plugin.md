---
"@lynx-js/react-rsbuild-plugin": minor
---

Choose the lazy bundle loader from `engineVersion`: use the new `fetchBundle`
loader when `engineVersion >= 3.9`, otherwise keep the legacy `QueryComponent`
loader.

```js
import('./Foo.jsx', { with: { mode: 'sync' | 'async' } });
```

Force a loader regardless of `engineVersion` with the `REACT_LAZY_BUNDLE_FETCHER`
env var (`FetchBundle` / `QueryComponent`).
