---
"@lynx-js/react-rsbuild-plugin": minor
---

feat(lazy-bundle): choose the lazy bundle loader from `engineVersion`

Select the new `fetchBundle` loader when `engineVersion >= 3.8`, otherwise keep
the legacy `QueryComponent` loader:

```js
import('./Foo.jsx', { with: { mode: 'sync' | 'async' } });
```

Force a loader regardless of `engineVersion` with the `REACT_LAZY_BUNDLE_FETCHER`
env var (`FetchBundle` / `QueryComponent`).
