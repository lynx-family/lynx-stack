---
"@lynx-js/react-webpack-plugin": patch
"@lynx-js/react": patch
---

Extend `experimental_reloadEntryReeval` to the background thread. On a Lynx core that installs its own `onAppReload`, `reloadTemplate` now hands the background back to core, which drops the app and evaluates the background entry again, instead of re-rendering the JSX of the previous render. Module scoped state of the background entry is then reset too. Cores without that support keep the re-render path, as does the default, disabled option.

The reload version both threads stamp patches with now lives on the page realm instead of in the runtime module, so it survives an entry that is evaluated again and the main thread keeps accepting what the reloaded background sends it.
