# react-shared-context

Two pages that share one module instance when they run in the same LynxGroup.

## What it shows

`src/store.ts` is imported by both entries, so `splitChunks` moves it into a
common chunk the pages load through `lynx.requireModuleAsync`. With
`enableLynxGroupModuleSharing` on, the group evaluates it once:

- **shared count** — moves together on both pages
- **module instance** — identical on both pages when shared, different when not
- **pages mounted** — every page that mounted against this module instance, so
  the second page lists both

Only `src/store.ts` goes into the common chunk. The framework stays in each
entry, so every page keeps its own renderer state.

`src/app.ts` is the group-level runtime. It is declared as a background-only
entry, so it builds to `app-runtime.js` with no main thread and no template;
the QR schema passes that URL as `standalone_url`, and the host loads it into
the group once, before any card.

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

A card with `enableLynxGroupModuleSharing` on and no standalone runtime in its
group fails to load with an `InternalRuntimeError`: sharing modules whose
globals die with one card is the bug the config exists to prevent, so dropping
`standalone_url` is a host misconfiguration rather than a fallback. To compare
against the isolated behavior, turn the page config off in `lynx.config.js`
instead.
