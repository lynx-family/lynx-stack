---
"@lynx-js/template-webpack-plugin": patch
---

Encode entry templates concurrently on the shared worker pool instead of one at a time. `react-rsbuild-plugin` registers one `LynxTemplatePlugin` instance per entry, and same-stage `processAssets` taps run serially, so the per-entry encodes were dispatched to the pool one after another. Each entry now pushes its un-awaited build into a shared per-compilation queue that a single coordinator tap awaits together, so multi-page builds use the full worker pool.
