---
"@lynx-js/web-core": minor
---

Load a hand-written Lynx XML markup card in the browser, by compiling it into a
`.web.bundle` there and then loading that.

A markup card is not a kind of artifact. The decode worker already dispatches on
the eight header bytes it reads - `{` for a `.json` template, the magic header for
a bundle - and a markup card is what neither of those claims, so it costs the two
shapes that stream nothing to reach. From there it is handed to `encodeLynxXML`,
the same function `@lynx-js/web-core/encode` gives a build, which returns real
bundle bytes: magic header, version, and the five sections in the encoder's order.
Those bytes go straight back to `handleStream`, so every section is read by the
reader that already existed. There is no markup decoding anywhere - not in the
worker, not on the main thread - and a markup card is not merely equivalent to a
built card, it _is_ one by the time anything decodes it.

Compiling in the browser is what #3589 made possible: `binary/encode`'s glue used
to load its wasm through `node:fs`, and is now generated with
`wasm-bindgen --target bundler`, which a bundler resolves on either platform.

**What this costs, measured**

Both sides rebuilt from source - `npm run build:wasm` then `rsbuild build`, with
`--force` so neither figure is a cache replay - because `binary/` is gitignored
and survives `git switch`, which has produced wrong numbers here before. Raw /
`gzip -9`.

| artifact                            | `origin/main`    | this change      | delta         |
| ----------------------------------- | ---------------- | ---------------- | ------------- |
| `binary/client/client_bg.wasm`      | 227,536 / 82,883 | _byte-identical_ | 0             |
| `binary/client_legacy/…_bg.wasm`    | 183,444 / 74,949 | _byte-identical_ | 0             |
| eager `client.js`                   | 45,287 / 14,388  | _byte-identical_ | 0             |
| `web-core-main-chunk.js`            | 159,621 / 33,074 | _byte-identical_ | 0             |
| `web-core-worker-chunk.js`          | 15,135 / 6,001   | _byte-identical_ | 0             |
| worker chunk (`…-loader-thread.js`) | 33,257 / 9,912   | 34,755 / 10,357  | +1,498 / +445 |
| `web-core-markup-encoder.js` (new)  | –                | 227,811 / 64,809 | new, lazy     |
| encode wasm asset (new)             | –                | 167,689 / 55,689 | new, lazy     |

So a card that was built ahead of time pays **+1,498 B raw / +445 B gzip**, all of
it in the worker chunk, and nothing at all in the eager entry or the main chunk.
The four byte-identical rows are sha256 comparisons, not size comparisons.

The laziness is load bearing rather than tidy: `TemplateManager` requests the
worker with `webpackPrefetch`, `webpackPreload` and `fetchPriority: "high"`, so a
static import would eagerly fetch all 395 kB for _every_ card. Verified positively
and with a negative control on `origin/main`, counting occurrences (a minified
chunk is one line, so a line count cannot tell 1 from 60):

| marker                       | eager `client.js` | worker chunk | main chunk | markup chunk |
| ---------------------------- | ----------------- | ------------ | ---------- | ------------ |
| encode wasm asset name       | 0                 | 0            | 0          | 1            |
| `css-tree` token names       | 0 / 0             | 0 / 0        | 0 / 0      | 2 / 2        |
| the XML parser's own message | 0                 | 0            | 0          | 2            |

All of these are 0 everywhere on `origin/main`, including in the chunk that does
not exist there. `encode_legacy_json_generated_raw_style_info` reads 2 in the
eager entry and 3 in the worker chunk on **both** sides - it is the _client_ wasm's
own export, used by `cssLoader` for `.json` artifacts, and is not this change.

Compiling itself is work that moved from a build into the browser, medians of 41
interleaved rounds: a 72 B stylesheet takes 0.42 ms, 872 B takes 0.89 ms, 9.1 kB
takes 7.4 ms and 26 kB takes 23.5 ms. Only markup cards pay it.

**Reviewer decisions this change deliberately leaves open**

- **`encodeLynxXML` warns on the console unconditionally, and now does so at
  runtime.** It reports each at-rule the Lynx style format cannot carry. That was
  written when the only caller was a build, which has no production runtime to
  stay quiet for; the same code now runs in a browser. It is left exactly as it is
  on `origin/main` so that `ts/encode/` keeps a zero diff, but gating it on a dev
  build, or deduplicating it per at-rule name, are both reasonable and neither is
  done here.
- **The published tarball grows by 397 kB**, being the new markup chunk plus the
  encode wasm, which rspack now also emits under `dist/client_prod/static/wasm/`.
  That wasm is consequently present three times in the package - there, under
  `dist/encode_prod/static/wasm/` since #3589, and under `binary/encode/`. Nothing
  here makes that worse than the pattern already in place for the client wasm, and
  reclaiming it is a `files` change that would alter what deep importers can
  reach, so it is left out of this change.
- **If #3390 lands first, the two chunk figures above need re-measuring.** It
  reaches `css-tree` directly where this change reaches it through
  `@lynx-js/css-serializer`; the spec resolves to a single `css-tree@3.2.1`, so
  rspack would either duplicate it into both lazy chunks or hoist it into a shared
  one. Nobody has built the union yet, so no combined figure is quoted here.

**Other limits worth knowing**

- `@lynx-js/css-serializer` becomes a real `dependency` rather than the optional
  peer it was. `dist/client` ships as unbundled ESM, so the `import` the compiler
  chunk performs is resolved by the consumer, and an optional peer nobody installs
  would make a markup card fail to load in exactly the packaging that looks fine
  on disk.
- **A corrupted bundle now reaches the markup path**, because markup is what is
  left when a response is neither a bundle nor JSON. Handing those bytes to the XML
  parser would answer `expected '<lynx version="...">' root element`, which points
  the reader at a markup bug in a file that is not markup, so the two are told
  apart first - before the compiler chunk is even fetched - on whether the content
  begins a tag at all. Bytes that do not keep the diagnosis they always had,
  `Invalid Magic Header`, now carrying the eight header bytes that failed to match;
  a document that does gets the XML parser's own message and offset. A response
  shorter than 8 bytes is still rejected by the header read, exactly as before.
- `@media`, `@supports` and `@layer` are dropped, as they already were when
  building a markup card into a bundle: Lynx's style format has no rule kind for a
  conditional group, so they are not Lynx features on any platform. Same for
  `@import` with a URL.
- The `handleMarkup` recursion is one level deep and cannot loop: `encode` writes
  the magic header at offset 0 unconditionally, so the second `handleStream` takes
  the binary branch. Were that untrue, the bytes would fail the "begins a tag"
  check and the recursion would end in a thrown error rather than a cycle.
