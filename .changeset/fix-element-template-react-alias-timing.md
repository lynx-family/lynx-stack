---
"@lynx-js/react-alias-rsbuild-plugin": patch
"@lynx-js/react": patch
---

Resolve bare `react` imports to the Element Template runtime when Element Template is enabled. Compile `__lynx_timing_flag` as a plain native attribute in Element Template so that string literals compile and dynamic string values reach the engine.
