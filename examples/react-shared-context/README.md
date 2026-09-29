# react-shared-context

Two cards that share one ReactLynx runtime when they run in the same LynxGroup.

## How it works

`splitChunks` moves every module both entries share — `src/store.ts` and the
ReactLynx framework itself — into a common chunk. The QR schema passes that
chunk's URL as `standalone_url`, so the host evaluates it once into the group
before any card, and every card's `lynx.requireModuleAsync` of the same URL gets
that evaluation back. With `experimental_lynxGroupModuleSharing` on, the cards
then share one instance of each module in it.

Each card renders through its own `createRoot(lynx)` from
`@lynx-js/react/internal`, so the shared runtime keeps their render state apart
while module-level state is shared on purpose.

## What each card shows

- **shared count** — module state; moves together on every card
- **module instance** — identical on every card
- **lazy module instance** — a module loaded with `import()`; also identical on
  every card
- **live pages** — the cards currently mounted against the shared store, so it
  drops a card when that card is destroyed and counts two cards of the same
  page (`Page A ×2`)
- **this page only** — component state; each card, and each new instance of the
  same card, starts from 0 and moves on its own
- **this page is isolated** — `useLynx()` returns the card's own `lynx`
- **this page holds the captured globals** — `store.ts` captures `setTimeout`,
  `clearTimeout`, `setInterval`, `clearInterval`, `requestAnimationFrame`,
  `cancelAnimationFrame` and `NativeModules` at eval time; the card's own must
  be the same objects, since both come from the standalone runtime
- **captured globals still work** — each captured timer fires, each canceller
  cancels, and the captured `Promise` resolves, from whichever card is open

## Run

```bash
pnpm dev
```

Scan both QR codes. Both URLs carry `group=shared-context-demo`, which puts the
cards in one JS context, and `standalone_url`, which makes the host load the
common chunk as the group runtime.

To walk through the edge cases:

1. Open Page A, then Page B: both show the same module and lazy module
   instances, and `live pages` lists both.
2. Tap **+1 now** and **+1 this page only** on Page B, then go back: Page A
   shows the new shared count and its own page-only count.
3. Open Page B again: the new instance renders, joins `live pages`, and starts
   its page-only count from 0.
4. Open Page A on top of it: `live pages` shows `Page A ×2`.
5. Tap **+1 after 1.5s** on Page B and go back right away: the count still moves
   on Page A, because the timer belongs to the standalone runtime rather than to
   the destroyed card.

A card with `experimental_lynxGroupModuleSharing` on and no standalone runtime in
its group fails to load with an `InternalRuntimeError`. To compare against the
isolated behavior, turn the option off in `lynx.config.js` instead of dropping
`standalone_url`.
