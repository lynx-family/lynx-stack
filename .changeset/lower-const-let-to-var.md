---
"@lynx-js/rspeedy": minor
"@lynx-js/react-rsbuild-plugin": minor
---

Lower `let`/`const` to `var` in the build output for faster QuickJS parsing. The SWC `transform-block-scoping` pass is added to both the background and main-thread layers (on top of the existing target baseline), and rspack `output.environment.const` is set to `false` so bundler-generated runtime code also uses `var`.
