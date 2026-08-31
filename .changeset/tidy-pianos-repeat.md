---
"@lynx-js/rsbuild-plugin": patch
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/vanilla-rsbuild-plugin": patch
---

Expose `Symbol.for('LynxTemplatePlugin')` from `pluginLynx` instead of from each DSL plugin, so the plugins that tap the template hooks work with the build engine alone.
