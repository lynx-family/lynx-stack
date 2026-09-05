---
"@lynx-js/react-rsbuild-plugin": minor
---

Add `experimental_backgroundOnlyEntries`, which builds the named entries as
background-only runtimes: no main thread and no template, just the background
bundle, for a host that runs it outside of any card. Such an entry still takes
part in chunk splitting, so it shares chunks with the pages built alongside it.
