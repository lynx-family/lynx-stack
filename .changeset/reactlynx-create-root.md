---
"@lynx-js/react": patch
---

Add `createRoot()` / `ReactLynxRoot` for rendering independent roots in one shared JS context, backed by per-root runtime state.

The runtime historically kept its render state in module-level singletons (`__root`, `__globalSnapshotPatch`, the commit task map, the instance registry, delayed event buffers, ...). When multiple pages share one background JS context (the cross-page `externals`/`globalThis` model), those singletons make concurrent roots clobber each other: component trees overwrite one another, two roots' snapshot patches merge into a single native stream, and hydration rewrites instance ids into colliding registry entries.

Each root now owns a private "register file" of that state, swapped in on entry (native calls, renders) and re-established per component via a Preact `renderComponent` hook, so hot paths keep reading the same module-level variables with zero overhead for the classic single-root app — whose behavior is unchanged.

`createRoot({ lynx, lynxCoreInject })` additionally binds a root to one card's own native bridge objects: incoming calls on that card's `tt` operate on that root only, and the root's outgoing patches (`rLynxChange`, `rLynxJSReady`) go to that card's native view only — no native-side changes required, since native already dispatches through per-card bridge objects.

It also fixes shared-context failures that only surface once a second card actually runs: the render scheduler is reclaimed on every native entry (each card bundle ships its own refresh runtime that overwrites `options.debounceRendering` on the _shared_ runtime with a closure bound to that card, so once such a card was destroyed its stale closure kept winning and no root could schedule a render again) and a throwing flush now resets Preact's scheduling counter instead of wedging it permanently; per-root cleanup tasks and the context-global `ctx not found` listener are no longer torn down when one card of a shared context is destroyed; and `firstScreen` re-asserts its own context after draining Preact's shared rerender queue, which may render another root's components.
