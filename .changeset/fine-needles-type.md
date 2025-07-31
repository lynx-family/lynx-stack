---
"@lynx-js/tailwind-preset": minor
---

Add support for Lynx UI plugin system with configurable options.

- Introduced `lynxUIPlugins` option in `createLynxPreset`, allowing userland opt-in to Lynx UI specific plugins.

- Implemented `uiVariants` plugin as the first UI plugin, supporting `ui-*` variant prefixes (e.g. `ui-checked`, `ui-open`) with customizable mappings.
