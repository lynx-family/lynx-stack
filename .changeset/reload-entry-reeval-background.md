---
"@lynx-js/react": patch
---

Reload the background entry on a Lynx core that can do it. Core installs an `onAppReload` of its own, which drops the app and loads the card again; the runtime now defers to it instead of re-rendering the JSX of the previous render, so module scoped state of the background entry is reset too. Cores without it keep the re-render. The background bundle is unchanged either way - only the main thread half of `experimental_reloadEntryReeval` touches the output.

Two things had to follow. The reload version both threads stamp patches with now lives on the page realm instead of in the runtime module, so it survives an entry that is evaluated again and the main thread keeps accepting what the reloaded background sends it. And the runtime now wires itself to the app that is running on every `root.render` rather than once per realm, because an externalized `@lynx-js/react` is not evaluated again when the entry is, which left the app a reload brought back with none of the runtime's hooks on it.
