---
applyTo: "packages/rspeedy/lynx-bundle-rslib-config/**"
---

Keep `@lynx-js/lynx-bundle-rslib-config` preset resolution extensible. `output.externalsPresetDefinitions` should live alongside `output.externalsPresets`, so business configs can register new preset names such as `tux` directly in their rslib config while wrappers still layer in defaults. New preset behavior should be expressed through exported preset-definition types and `extends` relationships rather than by hard-coding one-off merge logic outside the shared resolver.
