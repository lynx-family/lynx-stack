---
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/template-webpack-plugin": patch
"@lynx-js/lynx-bundle-rslib-config": patch
"@lynx-js/rsbuild-plugin": patch
---

`pluginReactLynx` registers the encoders and the background runtime wrapper for every caller, and `WebEncodePlugin` routes the custom sections of a bundle without a root into the slots the web runtime reads. `@lynx-js/lynx-bundle-rslib-config` only sets the template plugin and the main-thread wrapper up now.
