---
"@lynx-js/tailwind-preset": minor
---

Enable `lynxUIPlugins` (incl. `uiVariants`) by default. Fills the gap left by missing pseudo- and data-attribute selectors in Lynx, offering state and structural variants out of the box.

Opt-out globally or per plugin:

```ts
// disable all UI plugins
createLynxPreset({ lynxUIPlugins: false });
// or disable one plugin
createLynxPreset({ lynxUIPlugins: { uiVariants: false } });
```
