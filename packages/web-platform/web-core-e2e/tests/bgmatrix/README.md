<!--
Copyright 2026 The Lynx Authors. All rights reserved.
Licensed under the Apache License Version 2.0 that can be found in the
LICENSE file in the root directory of this source tree.
-->

# The `<Background>` matrix

Every position, import shape and fallback shape a `<Background>` can take,
built under all three `enableMTSRendering` settings and captured twice: once
with the background thread held, which is the frame the main thread produced
on its own (MTR), and once after releasing it (BTR).

It exists to answer a question no unit test can: _where does this mechanism
stop working, and is that an implementation gap or a limit?_

## Running it

```sh
node tests/bgmatrix.build.mjs                 # every permutation, both targets
LYNX_CHROMIUM_EXECUTABLE=… \
  npx playwright test --config=playwright.bgmatrix.config.ts
node tests/bgmatrix.report.mjs                # → bgmatrix-report/index.html
```

Three things are deliberate about the build step:

- **One build per permutation.** `enableMTSRendering` is a property of the
  build, so batching the cases would let one case's detection decide another's
  mode — every "did detection see this shape?" answer would be a sibling's.
- **Both targets.** The web bundle packs both threads into one artifact, so it
  cannot answer what left the _main-thread_ chunk. The Lynx build emits
  `main-thread.js` separately; `dist-bundle/` is only there to be read.
- **Split fixtures.** `sk.jsx`, `real.jsx` and `header.jsx` are separate
  modules in every case. Sharing one would make the fallback drag the deferred
  code in through its own module, and the bundle question would have no answer.

The fixtures assert on _logic_ markers (`SK-LOGIC`, `REAL-LOGIC`), never on
rendered text: host-element text travels to the main thread as part of the
snapshot definitions whether or not the code behind it did, so an assertion on
text would pass for the wrong reason.

## What it found

`<Background>` is two mechanisms under one name, and they have different
reach.

**The rendering boundary** — the component returns `fallback` on the main
thread and `children` on the background thread — is total. Every permutation
that builds paints its first frame on the main thread alone and is correct
after hydration: at the render root or three components deep, aliased,
namespaced, re-exported, behind a conditional, produced by a `.map()`, nested
inside another boundary's children or its fallback, with a stateful component
as the fallback or no fallback at all.

**The bundling boundary** — on the main-thread target the transform replaces
the element with its fallback, deleting the only reference to the deferred
subtree so tree-shaking can take it — is partial. It fails in exactly three
shapes, all of them the same sentence:

> a fold can only delete a reference it can see, in the module where the
> boundary is written.

| shape              | why the fold cannot act                                                             |
| ------------------ | ----------------------------------------------------------------------------------- |
| `i03-reexport`     | the element's name is not resolvable to the runtime export from inside this module  |
| `i05-dynamic-type` | the element type is a value; resolving it means running the program                 |
| `i04-wrapper`      | the boundary is resolvable, but the reference lives at the call site, a module away |

`f05-spread` is the same limit stated about the fallback instead of the child,
and it is the one case that refuses the build rather than degrading quietly.

`i04-wrapper` is the interesting one, because no amount of analysis inside the
module fixes it. The reference being deferred is `children` at the call site;
the boundary that would justify cutting it is inside `Deferred`. This is the
pressure that produced `'use client'`: React Server Components marks a
_module_, not an element, because a bundler splits a graph along import edges,
and an element can only ever speak for the one reference written beside it.

So: an element-level boundary can always express **when** something renders,
and can only sometimes express **where** it ships.

## What to do about it

The repo already ships the module-level half. `import 'background-only'`
resolves, in the main-thread layer, to a module that fails the build. Put it
in the deferred module and the fold's reach becomes checkable:

- `g01-assert-folded` — the boundary sits with the reference. Builds.
- `g02-assert-not-folded` — the same app in the `i04` wrapper shape. Fails,
  naming the module.

That does not make `i04` work; it makes `i04` say so. The rule it enforces is
the one the mechanism actually has: **write the boundary where the reference
is**, and assert it from the deferred module when the bundle matters.

The general escape — severing the edge rather than asserting about it — wants
to be on the import, because that is the thing a bundler splits on:

```jsx
import { Feed } from './feed.jsx' with { runtime: 'background' };
```

which would cut `i03`, `i04` and `i05` alike without needing to recognise a
`<Background>` at all. That is not implemented; this matrix is the argument
for it.
