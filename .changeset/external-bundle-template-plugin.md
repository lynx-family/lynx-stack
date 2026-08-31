---
"@lynx-js/lynx-bundle-rslib-config": minor
---

Assemble an external bundle with `LynxTemplatePlugin` instead of a parallel implementation. It now runs the template hooks, which is what a plugin taps to take part in the build, and the section names come from the chunks the assets belong to rather than from the entry filenames.

`ExternalBundleWebpackPlugin` is removed: `defineExternalBundleRslibConfig` sets the template plugin up itself. The template intermediates move into `.lynx`, matching an application build.
