---
"@lynx-js/external-bundle-rsbuild-plugin": patch
"@lynx-js/lynx-bundle-rslib-config": patch
"@lynx-js/externals-loading-webpack-plugin": patch
---

Default the ReactLynx preset to asynchronous loading on Harmony and web and synchronous loading on other platforms. Native builds use a runtime callback, while web builds always default to async regardless of host platform overrides. Consuming modules use promise semantics on every platform. Runtime-selected synchronous loads mount successful namespaces directly to preserve existing synchronous producer bundles, while failures remain cached as rejected promises. Explicit boolean or callback `async` options continue to override the default. The Rslib ReactLynx preset now awaits the mounted namespace by default, including when inherited by custom presets, so component bundles work with the host's default loading policy. An explicit `async: false` retains synchronous namespace access.
