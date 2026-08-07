---
"@lynx-js/web-core": minor
---

Load a hand-written Lynx XML markup card in the browser, through a lazily loaded
chunk and without an rkyv round trip.

A markup card needs a CSS parser, so `@lynx-js/css-serializer` and the `css-tree`
it re-exports now reach the client - but only behind a dynamic `import()`. The
eager `client.js` entry grows 1.4 kB raw / 0.3 kB gzip; the 213.7 kB / 60.3 kB
gzip parser lands entirely in a new `web-core-markup-template` async chunk, and
`web-core-main-chunk` is byte-for-byte unchanged. Verified positively rather than
by size inference: `css-tree` internals (`Atrule`, `SelectorList`,
`parseCustomProperty`, `parseAtrulePrelude`) occur 60 / 18 / 8 / 7 times in the
async chunk and **zero** times in the eager entry, and making the import static
moves exactly those counts into the eager entry while the async chunk disappears.

`StyleSheetResource.fromRawStyleInfo` is new, and builds a stylesheet straight
from a `RawStyleInfo`. The bundle path serialises a `DecodedStyleData` in the
decode worker only so the bytes can cross `postMessage`, then immediately
deserialises them on the main thread; neither pass carries information. Running
the conversion on the main thread removes the boundary instead of optimising it,
so both passes go away. The existing constructor's body is now shared with the
new entry, which is what keeps the two from drifting -
`encode_legacy_json_generated_raw_style_info`, which every ReactLynx JSON
artifact decodes through, is untouched.

**Limits worth knowing:**

- **The rkyv round trip was not the bottleneck.** Removing it saves 22.9% of the
  style step for a 13-byte stylesheet, but only 3.1% at 2.4 kB and 4.9% at 38 kB,
  because both paths run the same `StyleInfoDecoder` and that dominates. The
  rkyv envelope is only about 40 bytes larger than the decoded CSS text it
  carries, so what is saved is roughly two string copies, one allocation and a
  transfer of 156 B / 11 kB / 76 kB respectively. The `postMessage` hop itself is
  excluded from those figures - there is no worker to measure it across in jsdom
  - so they are a lower bound. The change is worth making because it is what
    lets a markup card be converted on the main thread at all, not because the
    serialisation was expensive.
- `@media`, `@supports` and `@layer` are dropped, as they already were when
  building a markup card into a bundle: Lynx's style format has no rule kind for
  a conditional group, so they are not Lynx features on any platform. Same for
  `@import` with a URL. Each is reported once per at-rule name, and only outside
  a production build.
- The report is suppressed where `process` does not exist. `dist/client` ships as
  unbundled ESM, and staying silent is a better failure than a `ReferenceError`
  while loading a card - but it does mean a bundler that leaves
  `process.env.NODE_ENV` undefined gets no diagnostics.
- The css-og declarations map is not compared between the two style paths. It is
  `pub(crate)` with no wasm getter, reachable only during element rendering, so
  only the end-to-end test covers it.
