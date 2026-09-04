---
"@lynx-js/lynx-bundle-rslib-config": minor
---

Assemble an external bundle with `LynxTemplatePlugin`, so plugins can tap the template hooks. Custom sections are named after their chunks, the intermediate files move into `.lynx`, and `ExternalBundleWebpackPlugin` is removed.

`target: 'tasm'` is renamed to `'lynx'`. The environment is now named after `target`, and `id` only names the emitted bundle.
