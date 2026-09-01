---
"@lynx-js/react": minor
---

Upgrade the bundled Preact fork to Preact 11 (`@lynx-js/internal-preact`
based on `11.0.0-rc.1`).

**Breaking:** `useEffect` cleanups of unmounted components no longer run
synchronously during unmount. They run in the after-paint flush instead,
matching React. This applies to `useLayoutEffect` too, which ReactLynx
exports as an alias of `useEffect`. Page destroy is unaffected — it drains
them synchronously, so cleanups that release native resources still run
before the runtime goes away. Code that assumed a cleanup had already run
right after a re-render removed the component needs to await a flush;
ReactLynx does not currently export a hook whose cleanup stays inside the
unmount commit.

Other runtime-visible changes:

- Context consumers no longer double-render on provider updates
  (preactjs/preact#4724), so fewer `rLynxChange` flushes are emitted and
  patches merge into the first flush.
- List reorders use Preact 11's longest-increasing-subsequence diff, which
  may pick an equivalent-but-different minimal set of moves.
