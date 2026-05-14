---
"@lynx-js/template-webpack-plugin": patch
---

Run TASM template encoding in a shared `tinypool` worker pool so multi-entry builds encode in parallel and watch-mode rebuilds reuse warm workers.
