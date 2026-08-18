---
"@lynx-js/react": patch
---

Tag main-thread vnodes with `$$typeof: Symbol.for('react.element')` so `isValidElement` recognizes them, matching the background thread.
