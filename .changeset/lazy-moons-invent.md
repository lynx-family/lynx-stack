---
"@lynx-js/react-rsbuild-plugin": patch
---

Add `pluginReactLynx({ profile })` for the ReactLynx runtime profiling switch. It takes precedence over the Rspeedy `performance.profile`, which is unset under plain Rsbuild.
