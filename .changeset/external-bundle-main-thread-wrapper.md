---
"@lynx-js/runtime-wrapper-webpack-plugin": patch
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/lynx-bundle-rslib-config": patch
---

Skip the background runtime wrapper on any asset marked `lynx:main-thread` instead of matching filenames, and mark the main-thread assets of an external bundle by the layer of their modules, so a main-thread entry an external bundle names itself is no longer wrapped.
