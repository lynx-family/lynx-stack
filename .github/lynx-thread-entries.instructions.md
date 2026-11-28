---
applyTo: "packages/rspeedy/plugin-{lynx,react}/**"
---

Keep Vanilla page assembly in the internal pluginVanilla. It compiles each page for both threads, registers its template, and marks the main-thread asset. Within one bundler-chain callback, configure entries and then pass their background asset names to configureTemplate in template.plugin.ts. Keep these artifacts local to the callback rather than sharing a mutable environment map or relying on plugin sorting. Keep runtime wrapping and native/Web encoder registration in configureTemplate, shared with pluginTemplate's existing rslib fallback. Keep application entry assembly out of rslib and rstest; an empty background asset list must not install a runtime wrapper. Do not duplicate encoding in the entry plugin or move utilities from Rspeedy core.

Use one encoder per environment and wrap only emitted native background assets. Direct entries do not install hot-update or live-reload clients. Remove the HMR compiler plugin only for Vanilla environments; do not mutate the normalized, read-only environment config. Cover standalone native and Web builds and run React plugin regressions when changing shared engine setup.

Resolve the encoder target at each caller. Rslib selects the Web encoder only for `web`; standalone entry assembly also supports `web-*` environments.

Keep engineVersion out of LynxPluginOptions and LynxConfig. Direct entries use the template encoder and runtime wrapper's existing default 3.2; DSL plugins retain their own engineVersion and legacy targetSdkVersion resolution. Neither engineVersion nor targetSdkVersion is a supported input of the current pluginLynxConfig. Keep page options there without forcing enableEventHandleRefactor during entry assembly. Entry sources are explicit module requests; do not add sibling discovery, legacy entry aliases, or a separate Vanilla adapter.

Register the shared engine config before its consumers within pluginLynx. DSL consumers read it in config hooks; do not add setup ordering requirements for engine versions. Preserve React's existing API exposure and bundler-hook ordering, and cover both explicit plugin registration orders.

Use the Vanilla example's Rsbuild config to test `pluginLynxConfig` with source entries in `plugin-lynx`. The example already declares both plugins, and loading its config avoids creating a workspace dependency cycle through Rspeedy core.

Use the existing Rsbuild source.entry shape for Vanilla applications. Consume the normalized bundler entries so source.preEntry and per-environment settings survive. Determine entry ownership from normalized entry layers in a post-order bundler-chain hook. Unlayered entries belong to the Vanilla fallback. DSLs must assign their layers before that hook. Reject mixed ownership within one environment. Derive development URLs from source.entry, which contains the page entries. Keep LAYERS exposure for its actual layer consumers.

Compile each Vanilla page entry once per thread. Keep the page entry name and choose a background entry name that does not collide with a configured page. Use layer-specific SWC definitions for `__MAIN_THREAD__` and `__BACKGROUND__`, and prune inactive branches before dependency resolution. Register listeners inside the example's setup functions.

Validate the compiled entrypoint graph before template encoding: each Vanilla thread entry must have exactly one JavaScript asset and no async chunks. Reject independent runtimes, extracted shared chunks, and cross-entry dependencies instead of packaging main-thread dependencies as background assets. Cover both threads and both native/Web targets, plus mixed DSL/Vanilla environments and preservation of DSL HMR.

Keep Vanilla layer constants inside the plugin package. Use the standard Rsbuild source.entry shape and compiler macros in application examples.

Register the LynXML loader in pluginVanilla. List each package-owned loader under `source.entry` in the package's Rslib config so Rspack can load it from `dist/loaders/`. For an external bundle the logical background chunk owns the <entry>:CSS section. Keep CSS asset resolution relative to the XML source and keep the external bundle producer independent of the input format.
