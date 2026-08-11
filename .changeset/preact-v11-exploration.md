---
"@lynx-js/react": minor
---

Migrate the bundled Preact fork to Preact 11 (`11.0.0-rc.0` based
`@lynx-js/internal-preact`).

Runtime-visible changes:

- Context consumers no longer double-render on provider updates
  (preactjs/preact#4724), so fewer `rLynxChange` flushes are emitted and
  patches merge into the first flush.
- Passive-effect cleanups of unmounted components run in the after-paint
  flush instead of synchronously during unmount, matching React. Snapshot
  mutations made by such cleanups are flushed to the main thread right
  after the effects run.
- List reorders use Preact 11's longest-increasing-subsequence diff, which
  may pick an equivalent-but-different minimal set of moves.
