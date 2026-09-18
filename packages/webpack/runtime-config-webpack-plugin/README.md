<h2 align="center">@lynx-js/runtime-config-webpack-plugin</h2>

A webpack plugin that merges runtime configuration into the page-scoped
`lynx.__runtime_configs__` object. Configuration keys are defined by the DSL
that consumes them. The merged top-level object is shallow-frozen after later
values overwrite earlier values with the same key.

Apply this plugin to the host compilation. Lazy and external bundles consume
the configuration injected by the host and should not apply the plugin.
