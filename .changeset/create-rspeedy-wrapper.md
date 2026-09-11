---
"@lynx-js/create-lynx": minor
"create-rspeedy": patch
---

`create-rspeedy` now delegates to `@lynx-js/create-lynx`, pinned to Rspeedy. It keeps its own templates no longer, so the two stay in step by construction. `@lynx-js/create-lynx` exports `createLynx()` for that.
