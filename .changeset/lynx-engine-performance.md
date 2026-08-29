---
"@lynx-js/rsbuild-plugin": minor
"@lynx-js/rspeedy": minor
---

Add `performance` to the `pluginLynx` options, alongside `output`, and expose it on the config `pluginLynx` provides. Rspeedy maps its `performance.profile` onto it, so a plugin can read the option from the build engine instead of requiring Rspeedy to be the caller.
