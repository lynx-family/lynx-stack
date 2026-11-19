---
"@lynx-js/rsbuild-plugin": minor
"upgrade-rspeedy": patch
---

Build Element PAPI applications directly from Rsbuild `source.entry` with `pluginLynx()` when the environment has no DSL template entries. A single page entry compiles for both threads with the `__MAIN_THREAD__` and `__BACKGROUND__` macros. Vanilla entries keep hot updates disabled and support native and Web encoding.

Direct entries use the template encoder and runtime wrapper's existing default engine version, `3.2`. DSL plugins retain their own version configuration.

Remove the Vanilla plugin from the workspace and upgrade list. Declare the page through `source.entry` and use thread macros to select its setup functions.

Keep Vanilla fallback and DSL template assembly independent per environment. Report a conflict when an environment contains both layered and unlayered entries. Reject unsupported runtime, shared, or async chunk layouts instead of emitting incomplete thread bundles.
