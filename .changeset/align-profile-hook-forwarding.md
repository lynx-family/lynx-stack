---
"@lynx-js/react": patch
---

Reduce profiling overhead in the Snapshot and Element Template backends by directly forwarding fixed arguments in diff, render, commit, and setState callbacks. Existing profiling events and state diagnostics are preserved. This change only affects execution with profiling hooks installed.
