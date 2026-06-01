---
applyTo: "examples/template-webpack/**/*"
---

This example builds a Lynx app without `pluginReactLynx()` or JSX. Keep application UI in `src/main-thread.ts` and construct it with native FiberElement Element PAPI calls such as `__CreatePage`, `__CreateText`, `__CreateRawText`, `__AppendElement`, `__SetClasses`, `__AddEvent`, and `__SetAttribute`.

Expose the native lifecycle bridge from `src/main-thread.ts` by assigning `renderPage`, `updatePage`, `getPageData`, and `processData` onto `globalThis`. Create the initial `FiberElement` tree in `renderPage`, mutate retained element references in `updatePage`, and call `__FlushElementTree()` after updates that should be committed to native.

Keep background-thread code in `src/background.ts` focused on app logic and event dispatch. For user interactions, register events from the main thread with `__AddEvent`, handle the published event in `lynxCoreInject.tt.publishEvent`, and use `lynx.getNativeApp().callLepusMethod('updatePage', payload)` to drive main-thread updates.

When changing bundle assembly, keep the template-webpack plugin logic in `plugin.js`. Preserve the explicit `card__background` and `card__main-thread` entries, and attach `src/style.css` to the `card__main-thread` import array so webpack owns CSS dependencies. Feed background code into `encodeData.manifest`, feed the main-thread asset into `encodeData.lepusCode`, and inject webpack-processed CSS from the emitted main-thread chunk CSS asset through `LynxTemplatePlugin.convertCSSChunksToMap`; do not read `src/style.css` directly with `fs`.
