---
"@lynx-js/react": patch
---

Report a development error when a page-data reset is combined with `withInitDataInState`.

`withInitDataInState` merges `lynx.__initData` into the wrapped component's state, so resetting the page data — `updatePage(..., { resetPageData: true })` on the main thread, or `updateData(..., { type: 'reset' })` on the background thread — cannot drop the keys the reset removed; the component keeps rendering the stale keys. A dev-only error is now reported (once per reset path) on both threads, pointing to `useInitData()` instead. The check is gated by `__DEV__` and is fully removed from production builds.
