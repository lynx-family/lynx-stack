---
"@lynx-js/external-bundle-rsbuild-plugin": patch
"@lynx-js/lynx-bundle-rslib-config": patch
---

Default the ReactLynx preset to asynchronous loading on Harmony and web and synchronous loading on other platforms. The default uses a runtime callback, so consuming modules use promise semantics on every platform. Explicit boolean or callback `async` options continue to override the default. The Rslib ReactLynx preset now awaits the mounted namespace by default, including when inherited by custom presets, so component bundles work with the host's default loading policy. An explicit `async: false` retains synchronous namespace access.
