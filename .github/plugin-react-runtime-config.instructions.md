---
applyTo: "packages/rspeedy/plugin-react/**"
---

Collect enabled runtime settings in one `runtimeConfig` object, and apply `RuntimeConfigWebpackPlugin` from `@lynx-js/runtime-config-webpack-plugin` only when that object is non-empty and the compilation is for a host page. Standalone lazy bundles and `rslib` products, including external bundles, must not apply the plugin; they consume the host-injected `lynx.__runtime_configs__`. Use the existing lazy option and caller context for this distinction rather than adding an external-bundle option. `experimental_transformBuiltinAttributeNames: false` disables the feature and does not contribute a runtime config entry; `true` and object rules do. Keep the actual builtin attribute-name transform configuration on the React loaders for compile-time JSX handling, and do not pass it to `ReactWebpackPlugin`.
