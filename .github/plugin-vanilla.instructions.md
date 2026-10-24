---
applyTo: "packages/rspeedy/plugin-vanilla/**"
---

Keep `pluginVanillaLynx` as the Vanilla Lynx DSL integration layer; do not move Vanilla entry conventions into the DSL-neutral `pluginLynx` base.

Mark emitted main-thread assets with `asset.info['lynx:main-thread']` before `LynxTemplatePlugin` groups assets. Do not manually replace `encodeData.manifest` or `encodeData.lepusCode`.

Keep Element PAPI code on the main-thread entry and wrap only optional background-thread assets with `RuntimeWrapperWebpackPlugin`.

Treat both `lynx` / `lynx-*` and `web` / `web-*` as Vanilla template environments. Use `LynxEncodePlugin` and background runtime wrapping only for Lynx; use `WebEncodePlugin` with unwrapped background JavaScript for Web so `[platform]` emits a loadable `.web.bundle`.

Vanilla Lynx HMR and live reload must remain disabled until the plugin installs and tests a compatible hot-update runtime.
