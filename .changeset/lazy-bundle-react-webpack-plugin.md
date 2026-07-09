---
"@lynx-js/react-webpack-plugin": minor
---

feat(lazy-bundle): route `processEvalResult` to the owning host

Evaluate a lazy bundle against the host that requested it, so multiple hosts on
one page each get their own eval result instead of sharing a single one.
