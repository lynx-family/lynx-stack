---
"@lynx-js/react": patch
---

Add a DEV-only guard that detects MainThread flush loops caused by re-entrant MTS handlers.

This typically happens when a MainThread handler (e.g. event callback or `MainThreadRef`) performs UI mutations (like `Element.setStyleProperty`, `setStyleProperties`, `setAttribute`, or `invoke`) that synchronously trigger a flush which re-enters the handler again.
