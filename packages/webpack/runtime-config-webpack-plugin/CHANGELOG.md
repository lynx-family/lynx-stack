# @lynx-js/runtime-config-webpack-plugin

## 0.0.1

### Patch Changes

- Move runtime attribute-name configuration to the page-scoped `lynx` object and ([#3718](https://github.com/lynx-family/lynx-stack/pull/3718))
  inject it from the host compilation through a standalone webpack plugin. Lazy
  and external bundles reuse the host-injected configuration without applying
  the plugin themselves. The runtime-config webpack plugin is published through
  its own DSL-neutral package entry and accepts arbitrary runtime configuration
  keys without depending on ReactLynx. The merged top-level configuration is
  shallow-frozen to prevent accidental mutation after host initialization.
- Updated dependencies [[`76126fc`](https://github.com/lynx-family/lynx-stack/commit/76126fcad0f16e649c372d22c013e90ad88640df)]:
  - @lynx-js/webpack-runtime-globals@0.0.8
