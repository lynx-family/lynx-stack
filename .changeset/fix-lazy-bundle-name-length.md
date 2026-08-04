---
"@lynx-js/template-webpack-plugin": patch
---

Bound the length of lazy bundle names. A name is derived from the resolved module paths, which are unbounded — in a pnpm workspace a single directory encodes every peer dependency — and becomes a path where the bundle is unpacked. Past 100 characters the directories are now replaced by a digest of the full name, keeping the file name. Shorter names are unchanged.
