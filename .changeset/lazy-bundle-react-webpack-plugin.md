---
"@lynx-js/react-webpack-plugin": minor
---

Route `processEvalResult` to the host that requested the lazy bundle, so multiple
hosts on one page each get their own eval result instead of sharing a single one.
