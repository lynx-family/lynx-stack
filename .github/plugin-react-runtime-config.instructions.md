---
applyTo: "packages/rspeedy/plugin-react/**"
---

Collect enabled runtime settings in one `runtimeConfig` object, and apply `RuntimeConfigWebpackPlugin` from `@lynx-js/runtime-config-webpack-plugin` only when that object is non-empty and the compilation is for a host page. Standalone lazy bundles and `rslib` products, including external bundles, must not apply the plugin; they consume the host-injected `lynx.__runtime_configs__`. Use the existing lazy option and caller context for this distinction rather than adding an external-bundle option. `experimental_transformBuiltinAttributeNames: false` disables the feature and does not contribute a runtime config entry; `true` and object rules do. Keep the actual builtin attribute-name transform configuration on the React loaders for compile-time JSX handling, and do not pass it to `ReactWebpackPlugin`.

The host must contribute its `globalPropsMode`, including the `reactive` default, so it overrides an earlier value. Keep the mode in the same host configuration object as builtin attribute-name settings, without allowing lazy and external bundles to override the host. Preserve the `__GLOBAL_PROPS_MODE__` compile-time definition for historical consumers, but do not read it in the React runtime; a missing runtime mode defaults to `reactive`.
