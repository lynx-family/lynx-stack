---
applyTo: "packages/webpack/template-webpack-plugin/**/*"
---

When changing default values in `sourceContent.config` emitted by `LynxTemplatePlugin`, update the template plugin default config snapshot and any webpack/css-extract snapshots that serialize the same encode data. The template default snapshot is sorted by the test harness, while emitted JSON snapshots preserve object insertion order.
