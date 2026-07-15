---
"@lynx-js/debug-metadata-rsbuild-plugin": minor
---

Keep lazy bundle source maps in `debug-metadata.json` now that async chunk groups are unnamed: the collectors resolve a bundle's chunk groups from the files its encode data enumerates instead of looking them up by chunk-group name.
