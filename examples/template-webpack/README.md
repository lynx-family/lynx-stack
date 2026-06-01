# template-webpack

## What This Example Demonstrates

This template is intentionally not a ReactLynx app. It builds the Lynx UI with native `FiberElement` Element PAPI calls in `src/main-thread.ts`, then packages the generated main-thread asset, background asset, and CSS into `dist/card.bundle`.

Use this example when you need to understand the lower-level Lynx bundle assembly path:

- `src/main-thread.ts` creates and updates the UI tree with APIs such as `__CreatePage`, `__CreateText`, `__CreateRawText`, `__AppendElement`, `__SetClasses`, `__SetAttribute`, and `__FlushElementTree`.
- `src/background.ts` handles application logic and event dispatch. It receives the published `handleClick` event and calls `lynx.getNativeApp().callLepusMethod('updatePage', payload)` to update main-thread state.
- `src/style.css` is built through the webpack CSS pipeline, then converted into encoded template CSS data.
- `plugin.js` defines `pluginTemplateWebpack()`, the custom Rspeedy plugin that wires webpack entries and fills `LynxTemplatePlugin` encode data.
- `lynx.config.js` keeps the app-level Rspeedy configuration and composes `pluginTemplateWebpack()` with the QR code plugin.

## Bundle Assembly Flow

`pluginTemplateWebpack()` replaces the default Rspeedy entries with two explicit entries:

- `card__background` emits `.rspeedy/card/background.js`.
- `card__main-thread` imports `src/main-thread.ts` and `src/style.css`, emits `.rspeedy/card/main-thread.js`, and lets webpack emit the extracted CSS asset for the same chunk.

The plugin then:

- creates the template container with `LynxTemplatePlugin`;
- wraps only `background.js` with `RuntimeWrapperWebpackPlugin`;
- enables final bundle encoding with `LynxEncodePlugin`;
- uses `LynxTemplatePlugin`'s `beforeEncode` hook to place `background.js` into `encodeData.manifest`, `main-thread.js` into `encodeData.lepusCode`, and webpack-processed CSS from the `card__main-thread` chunk into `encodeData.css`.

The final Lynx bundle is emitted as:

```text
dist/card.bundle
```

## Run

From this directory:

```bash
pnpm build
pnpm dev
```

From the repository root:

```bash
pnpm --dir examples/template-webpack build
pnpm --dir examples/template-webpack dev
```
