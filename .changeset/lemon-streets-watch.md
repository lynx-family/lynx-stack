---
"@lynx-js/react": minor
---

fix: Delay execution of `runOnMainThread()` during initial render

When called during the initial render, `runOnMainThread()` would execute before the `main-thread:ref` was hydrated, causing it to be incorrectly set to null.

This change delays the function's execution to ensure the ref is available and correctly assigned.
