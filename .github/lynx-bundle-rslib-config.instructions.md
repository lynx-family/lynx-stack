---
applyTo: "packages/rspeedy/lynx-bundle-rslib-config/**"
---

ReactLynx producer presets must await the mounted namespace by default because the host's platform callback uses Promise semantics even on Android and iOS. Put this default in the built-in definition so extending presets inherit it, and preserve explicit `async: false` for synchronous hosts.

Keep `@lynx-js/lynx-bundle-rslib-config` preset resolution extensible. `output.externalsPresetDefinitions` should live alongside `output.externalsPresets`, so business configs can register new preset names such as `lynxUi` directly in their rslib config while wrappers still layer in defaults. New preset behavior should be expressed through exported preset-definition types and `extends` relationships rather than by hard-coding one-off merge logic outside the shared resolver.
