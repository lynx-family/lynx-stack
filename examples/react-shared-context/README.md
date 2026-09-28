# react-shared-context

Two cards that share one ReactLynx runtime when they run in the same LynxGroup.

## What it shows

`splitChunks` moves every module both entries share — `src/store.ts` and the
ReactLynx framework itself — into a common chunk the cards load through
`lynx.requireModuleAsync`. With `experimental_lynxGroupModuleSharing` on, the
group evaluates that chunk once, so both cards run on one framework instance and
one `store.ts`:

- **shared count** — moves together on both cards
- **module instance** — identical on both cards when shared, different when not
- **pages mounted** — every card that mounted against this module instance, so
  the second card lists both

Each card renders through its own `createRoot(lynx)`, so the one shared runtime
keeps their render state apart while they share module-level state on purpose.

The common chunk is also the group-level runtime. The QR schema passes its URL
as `standalone_url`, so the host evaluates it into the group once, before any card,
and the cards' `lynx.requireModuleAsync` of the same URL reuses that evaluation.

## The checks

The module captures the globals bound to the LynxView lifecycle at eval time,
on purpose. They belong to whichever page evaluated it first, so they have to
come from the standalone runtime to outlive that page. Both pages run the same
two groups of checks and show a line per check:

**this page holds the captured globals** compares the page's own
`setTimeout`, `clearTimeout`, `setInterval`, `clearInterval`,
`requestAnimationFrame`, `cancelAnimationFrame` and `NativeModules` against the
ones the module captured. They must be the same objects. With sharing on the
module was evaluated by the standalone runtime, so a match proves the page's
globals are the standalone's; a mismatch means the page took a global off its
own LynxView, which stops working once that page is destroyed.

**captured globals still work** exercises the captured references instead of
comparing them — each timer fires, each canceller cancels, and the captured
`Promise` resolves. These run from whichever page is open, including one that
did not evaluate the module.

**+1 after 1.5s** is the same thing end to end: it bumps the shared counter
through the captured timer and Promise. Run it from the second page, then go
back — the counter moved.

## Run

```bash
pnpm dev
```

Scan both QR codes. Both URLs carry `group=shared-context-demo`, which is what
puts the two cards in one JS context, and `standalone_url`, which is what makes
the host load the group-level runtime.

A card with `experimental_lynxGroupModuleSharing` on and no standalone runtime in its
group fails to load with an `InternalRuntimeError`: sharing modules whose
globals die with one card is the bug the config exists to prevent, so dropping
`standalone_url` is a host misconfiguration rather than a fallback. To compare
against the isolated behavior, turn the page config off in `lynx.config.js`
instead.
