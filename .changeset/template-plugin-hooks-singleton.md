---
"@lynx-js/template-webpack-plugin": patch
---

Fix `LynxTemplatePlugin.getLynxTemplatePluginHooks` returning per-module-instance hooks when this package is loaded from multiple physical paths under `node_modules` (e.g. npm hoist conflicts that nest two copies). Hooks storage is now keyed by `Symbol.for(...)` on the `compilation` itself, so any copy of the plugin resolves to the same hooks for a given compilation. This eliminates the "`Cannot destructure property 'buffer' of '(intermediate value)' as it is undefined`" build error that occurred when `LynxEncodePlugin` registered taps via one module instance while `LynxTemplatePlugin` awaited `hooks.encode.promise(...)` on another.
