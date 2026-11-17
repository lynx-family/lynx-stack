---
"@lynx-js/react": patch
---

Enrich React `ref.invoke()` selector lookup failures (`NODE_NOT_FOUND` and `NO_UI_FOR_NODE`) with the invoked method, snapshot/template identifier, and development `exec()` call stack (including development warnings when `options.fail` is omitted).
