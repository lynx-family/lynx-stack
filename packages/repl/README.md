# @lynx-js/repl

A **pure-browser** playground for Vanilla Lynx. Users write raw Element PAPI code and see it rendered in real time — no local toolchain, no server, no install.

## Architecture Principle: Pure Browser, Zero Server

This REPL runs **entirely in the browser**. The built artifact is a static site that can be deployed to any CDN or GitHub Pages. There is no compilation server, no Node.js dependency at runtime, and no network round-trip in the edit-preview loop.

An alternative approach would be to run a local (or remote) Node.js server that invokes rspack for each edit — effectively a browser-based editor bolted onto the real build pipeline. We deliberately chose **not** to do this because:

1. **If you need a local server, you already have Node.js** — at that point `rspeedy dev` gives you a strictly better experience (your own editor, incremental builds, HMR, full plugin pipeline).
2. A server-backed REPL sits in an awkward middle ground: it loses the zero-setup advantage of a pure-browser tool while offering a worse DX than the real toolchain.
3. The value of this REPL is precisely that it **does not overlap** with `rspeedy dev`. It serves a different audience (learners, docs, quick experiments) with a different tradeoff (instant access, limited features).

## Where We Cut Into the Build Pipeline

A standard Lynx project goes through 8 steps from source to bundle:

```text
Step  What happens                        Tool / Plugin
────  ──────────────────────────────────   ─────────────────────────────
 1.   Source Transform (JSX/TS → JS)       rspack loader (SWC)
 2.   Module Resolution (import/require)   rspack resolver
 3.   CSS Processing (CSS → LynxStyleNode) @lynx-js/css-serializer
 4.   Bundling (multi-file → chunks)       rspack
 5.   Asset Tagging (lynx:main-thread)     MarkMainThreadPlugin
 6.   Template Assembly (assets → data)    LynxTemplatePlugin
 7.   Encoding (data → binary/JSON)        @lynx-js/tasm / WebEncodePlugin
 8.   Emit (write to disk)                 rspack compilation
```

This REPL **enters at step 6** and takes a shortcut:

```text
 rspeedy dev (full pipeline):
   [1] → [2] → [3] → [4] → [5] → [6] → [7] → [8] → lynx-view (via URL fetch)

 This REPL (pure browser):
                              [3'] → [6'] ─────────→ lynx-view (via callback)
```

- **Step 3' (planned):** Parse user CSS in-browser via `@lynx-js/css-serializer` (pure JS, based on `csstree`) and `genStyleInfo` (pure TS) to produce `styleInfo`.
- **Step 6':** Directly construct a `LynxTemplate` JS object from the user's code strings and the processed `styleInfo`. No webpack compilation, no asset pipeline.
- **Delivery:** The template object is handed to `<lynx-view>` via the `customTemplateLoader` callback — no encoding, no file I/O, no URL fetch.

Steps 1, 2, 4, 5 are skipped entirely because the user writes final-form JS (no JSX, no imports, no multi-file). Steps 7–8 are skipped because `<lynx-view>` can consume a `LynxTemplate` object directly.

## Functional Boundaries

What this REPL **can** do:

- All Element PAPIs (`__CreateElement`, `__AppendElement`, `__AddInlineStyle`, etc.)
- CSS class selectors, `@keyframes`, `@font-face`, CSS variables (after L1 is implemented)
- Inline styles via `__AddInlineStyle`
- Real-time preview with Lynx Web runtime (`<lynx-view>`)
- Dual-thread model: main-thread.js (Lepus) + background.js (Web Worker)

What this REPL **cannot** do (by design):

- `import` / `require` — no module resolution, no bundler
- JSX / TypeScript — no source transform
- Export `.lynx.bundle` — requires `@lynx-js/tasm` (Node native addon)
- Export `.web.json` binary — possible in future but not a priority
- Multi-file projects — single main-thread.js + background.js + index.css

Users who need any of the above should use `rspeedy dev`.

## Target Capability: L0 + L1

We target two capability levels, both achievable in pure browser:

| Level            | Capability                          | Browser dependency                         |
| ---------------- | ----------------------------------- | ------------------------------------------ |
| **L0** (done)    | Raw Element PAPI with inline styles | None (zero extra KB)                       |
| **L1** (planned) | + CSS class selectors               | `@lynx-js/css-serializer` (~200KB gzipped) |

Higher levels (JSX, module imports, bundle export) are **not planned** — they would move toward `rspeedy dev` territory without matching its DX.
