---
"@lynx-js/react-refresh-webpack-plugin": patch
---

Re-render components hot-updated right after a failed build. A fix that replaced the error module of a failed build was evaluated without flushing React Refresh, so neither thread re-rendered and the change only showed on the next edit.
