---
"@lynx-js/react": patch
---

Clean up direct callback refs when they are set to `null` or `undefined` after hydration in the Snapshot backend. Call the binding's returned cleanup, or pass `null` to the callback when no cleanup was returned, without repeating cleanup on a later unmount.
