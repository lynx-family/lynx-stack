---
"@lynx-js/rspeedy": patch
---

Tell `initConfigs` which action the preview command is for. Without it Rsbuild does not know the action yet when the plugins are initialized, and skips every plugin's `apply` filter.

Leave the `dev.lazyCompilation` default to `@lynx-js/rsbuild-plugin`, which now applies it for the Rsbuild CLI too.
