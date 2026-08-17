---
"@lynx-js/react": patch
"@lynx-js/react-webpack-plugin": patch
---

Exclude exhaustive ReactLynx component-hook profiling code from default
production Web artifacts. `performance.profile: true` keeps the full Web
profiling implementation, while Lynx artifacts retain it for native
host-driven production recording.
