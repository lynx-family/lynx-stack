# A2UI Playground — Showcase grid bundle-loading optimization

**Date:** 2026-05-28
**Scope:** `packages/genui/a2ui-playground` only
**Status:** Approved (approach B)

## Problem

`DemosListPage.tsx` ("Examples" / Showcase tab) renders a card grid with
**43 cards** (8 `EXTENDED_STATIC_DEMOS` + 35 `OFFICIAL_STATIC_DEMOS`).

Each card immediately mounts a `<PreviewViewport>` that contains an
`<iframe src="render.html?...&instant=1">`. Every iframe:

1. Imports `@lynx-js/web-core/client` + `@lynx-js/web-elements/all`.
2. Mounts `<lynx-view url="/main.web.js" thread-strategy="multi-thread" />`.
3. Web-core spawns a **dedicated Web Worker** per iframe (multi-thread mode).
4. Fetches/parses `main.web.js`, boots the Lynx app, replays the demo
   messages with `instant=1`.

Result: ~43 iframes × (web-core runtime + element registration + Worker
spawn + Lynx app boot + A2UI render) all initialise in parallel on page
load. The page becomes unresponsive; TTI is unusable.

The iframes also have no `loading="lazy"` attribute, so the browser's own
deferral mechanism never kicks in.

## Goal

- TTI / interactivity within ~1–2 s on the Showcase page.
- Cards visible to the user render first.
- No regression in per-card visual fidelity (same iframe + lynx-view path
  once a card is mounted).
- No changes outside `packages/genui/a2ui-playground`.

## Approach — Concurrency-capped, viewport-prioritized mount queue

All 43 card chrome elements still render immediately (titles visible,
layout stable). But the iframe **inside** each `PreviewViewport` is gated
by a queue.

- A page-scoped `MountQueue` holds at most `MAX_CONCURRENT = 4` "armed"
  cards at any time. Armed cards get their `src` prop set → iframe loads.
- Each card's visibility is tracked by an `IntersectionObserver` with
  `rootMargin: '50% 0px'` (load when within half a viewport).
- The queue picks the top-K **visible** cards by priority. Cards not in
  the viewport stay pending — they never mount until the user scrolls
  toward them.
- A card releases its slot when the iframe finishes its first boot. The
  existing `A2UI_RENDER_READY` `postMessage` (already sent by
  `render.tsx:244–247`) is the primary signal. Fallback: `iframe.onLoad`
  plus a 5 s safety timeout, so the queue cannot stall on a failed iframe.

## Architecture

```text
DemosListPage
  └─ <MountQueueProvider maxConcurrent={4}>
     └─ ExampleCard (× 43)
        ├─ IntersectionObserver on own container
        ├─ useQueuedMount(id, visibility) → { armed, onReady }
        └─ PreviewViewport(src = armed ? previewUrl : undefined)
                          (existing empty state is used when src falsy)
```

## Components

| File                                 | Status        | Responsibility                                                                                          |
| ------------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------- |
| `src/utils/mountQueue.ts`            | **new**       | Pure-JS class. `register / unregister / setPriority / markReady / subscribe`. Zero React deps.          |
| `src/utils/mountQueue.test.ts`       | **new**       | Unit tests for the queue (TDD).                                                                         |
| `src/hooks/useMountQueue.ts`         | **new**       | `MountQueueProvider`, `useQueuedMount(id, visibility)` hook.                                            |
| `src/pages/DemosListPage.tsx`        | **modified**  | Wrap grid in provider; extract inline card JSX into `ExampleCard` (local) with observer + queue wiring. |
| `src/components/PreviewViewport.tsx` | **unchanged** | Gating happens upstream via the `src` prop.                                                             |
| `src/render.tsx`                     | **unchanged** | Already sends `A2UI_RENDER_READY`. We just consume it.                                                  |

## Data flow

1. `ExampleCard` mounts → `mountQueue.register(id)` (priority `OFFSCREEN`).
2. `IntersectionObserver` callback → `mountQueue.setPriority(id, OFFSCREEN | NEAR | IN_VIEW)`.
3. Queue re-evaluates: top-K cards with priority ≥ `NEAR` become armed
   (in document order within the same priority tier, so above-the-fold
   wins ties).
4. Armed card receives `src` → iframe mounts → `render.tsx` boots →
   posts `A2UI_RENDER_READY`.
5. `ExampleCard`'s `message` listener (filtered to its own iframe's
   `contentWindow`) calls `mountQueue.markReady(id)` on first occurrence.
6. Queue frees that slot, promotes next-highest-priority pending card.

## Error handling

- **No `A2UI_RENDER_READY` in 5 s after `iframe.onLoad`** → fire
  `markReady(id)` from a timeout so a broken iframe cannot block the
  queue. The card stays mounted (the user can still see whatever the
  iframe rendered, even if it's broken).
- **`IntersectionObserver` unsupported** → fall back to giving every
  card priority `IN_VIEW` immediately. Behaviour degrades to pure FIFO
  concurrency-cap (Approach A) — still correct, just less optimal.
- **Card unmounts while armed** → `unregister(id)` frees the slot.

## Testing

### Unit (`mountQueue.test.ts`, rstest)

- `register` returns `armed=false` initially.
- Up to `maxConcurrent` cards become armed in registration order when
  set to `IN_VIEW`.
- A higher-priority card preempts an `OFFSCREEN` card.
  _(Note: "preempts" only when slots are full and an offscreen card was
  speculatively armed — in our flow, offscreen cards never arm in the
  first place, so this test asserts they stay un-armed.)_
- `markReady` frees the slot; next pending card becomes armed.
- Two-tier priority: when a `NEAR` and an `IN_VIEW` card are both
  pending and one slot opens, `IN_VIEW` wins.
- `unregister` on an armed card frees the slot.
- `subscribe`/`unsubscribe` pattern: listeners notified only on real
  changes.

### Manual

1. `pnpm -C packages/genui/a2ui-playground build:lynx` (one-time).
2. `PORT=5371 pnpm -C packages/genui/a2ui-playground dev` (unique port
   avoids conflicting with other devs servers).
3. Open `http://localhost:5371` → click "Examples" tab.
4. DevTools → Network: at most 4 in-flight `main.web.js` requests at
   any moment; rest queued/pending.
5. DevTools → Performance: main thread idle within ~2 s of navigation.
6. Scroll: more iframes mount as cards enter the viewport's
   half-viewport halo.

## Tunables (constants in `DemosListPage.tsx`)

| Constant                  | Default     | Purpose                          |
| ------------------------- | ----------- | -------------------------------- |
| `MAX_CONCURRENT`          | `4`         | Slots in the queue.              |
| `ROOT_MARGIN`             | `'50% 0px'` | Pre-load halo for the observer.  |
| `RENDER_READY_TIMEOUT_MS` | `5000`      | Safety timeout to free the slot. |

## Non-goals

- Snapshot/poster caching (Approach C). Larger change, separate spec.
- Generalising to other pages (`OpenUIDemosPage`, `ComponentsPage`).
  If the pattern proves itself, we can lift it into a shared component
  later.
- Changes to `web-core` / `lynx-view` (e.g. lazy `thread-strategy`).
  Out of scope per user direction.
