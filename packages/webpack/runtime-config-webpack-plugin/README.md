<h2 align="center">@lynx-js/runtime-config-webpack-plugin</h2>

A webpack plugin that sets the page-scoped `lynx.__runtime_configs__` object to
this bundle's runtime configuration. Configuration keys are defined by the DSL
that consumes them. Each host entry evaluation replaces the entire object,
clearing stale configuration from previous evaluations. The new object remains mutable.

Apply this plugin to the host compilation. Lazy and external bundles consume
the configuration injected by the host and should not apply the plugin.
