---
applyTo: "packages/rspeedy/lynx-bundle-rslib-config/**"
---

Keep `@lynx-js/lynx-bundle-rslib-config` preset resolution extensible. `output.externalsPresetDefinitions` should live alongside `output.externalsPresets`, so business configs can register new preset names such as `lynxUi` directly in their rslib config while wrappers still layer in defaults. New preset behavior should be expressed through exported preset-definition types and `extends` relationships rather than by hard-coding one-off merge logic outside the shared resolver.

Wrap main-thread external scripts after JavaScript minification and before source-map generation. A minifier can inline the wrapper and expose declarations to other scripts in the same Lynx host. Exercise that boundary by evaluating production sections in a shared context.
