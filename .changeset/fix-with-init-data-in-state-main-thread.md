---
"@lynx-js/react": patch
---

Fix `withInitDataInState` not refreshing the component state on a main-thread re-render.

`withInitDataInState` injected `lynx.__initData` into the class component's state only in the constructor, and its `onDataChanged` listener was active on the background thread only. On the main thread the component instance is reused across an `updatePage` re-render (the constructor never re-runs), so the injected state stayed frozen at the data from the first render. This surfaces whenever the main thread re-renders the screen itself before hydration (an `updatePage` while `firstScreenSyncTiming` is `'jsReady'`). The HOC now re-reads `lynx.__initData` on every render via `getDerivedStateFromProps`, composing with — and not overriding — the wrapped component's own `getDerivedStateFromProps`.
