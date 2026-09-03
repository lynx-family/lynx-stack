---
"@lynx-js/react": patch
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/react-webpack-plugin": patch
"@lynx-js/runtime-config-webpack-plugin": patch
"@lynx-js/testing-environment": patch
"@lynx-js/webpack-runtime-globals": patch
---

Move runtime attribute-name configuration to the page-scoped `lynx` object and
inject it from the host compilation through a standalone webpack plugin. Lazy
and external bundles reuse the host-injected configuration without applying
the plugin themselves. The runtime-config webpack plugin is published through
its own DSL-neutral package entry and accepts arbitrary runtime configuration
keys without depending on ReactLynx. The merged top-level configuration is
shallow-frozen to prevent accidental mutation after host initialization.
