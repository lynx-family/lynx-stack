# react-shared-context

Two pages that share one module instance when they run in the same LynxGroup.

## What it shows

`src/store.ts` is imported by both entries, so `splitChunks` moves it into a
common chunk the pages load through `lynx.requireModuleAsync`. With
`experimental_lynxGroupModuleSharing` on, the group evaluates it once:

- **shared count** — moves together on both pages
- **module instance** — identical on both pages when shared, different when not

Only `src/store.ts` goes into the common chunk. The framework stays in each
entry, so every page keeps its own renderer state.

The common chunk is also the group-level runtime. The QR schema passes its URL
as `standalone_url`, so the host evaluates it into the group once, before any card,
and the cards' `lynx.requireModuleAsync` of the same URL reuses that evaluation.

The module captures `setTimeout` and `Promise` at eval time on purpose. They
belong to whichever page evaluated it first, so **+1 after 1.5s** keeps working
from a second page only when the timers come from the standalone runtime.

## Run

```bash
pnpm dev
```

Scan both QR codes. Both URLs carry `group=shared-context-demo`, which is what
puts the two cards in one JS context. Drop the `group` query to compare against
the isolated behavior.
