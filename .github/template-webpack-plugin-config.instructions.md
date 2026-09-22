---
applyTo: "packages/webpack/template-webpack-plugin/**/*"
---

When changing default values in `sourceContent.config` emitted by `LynxTemplatePlugin`, update the template plugin default config snapshot and any webpack/css-extract snapshots that serialize the same encode data. The template default snapshot is sorted by the test harness, while emitted JSON snapshots preserve object insertion order.

Keep emitted `sourceContent.config` keys exactly aligned with the canonical names in `lynx-family/lynx`'s `core/template_bundle/template_codec/binary_decoder/lynx_config.yml`; similarly named keys are ignored by the native decoder.
