---
"@lynx-js/vanilla-rsbuild-plugin": patch
---

Wrap the background chunk again. The runtime wrapper only matched assets under `.rspeedy/`, so once the intermediate directory moved to `.lynx/` the background chunk shipped without the wrapper and failed on load with `ReferenceError: lynx is not defined`. The wrapper now targets the background asset the plugin emits, wherever the intermediate directory lives.
