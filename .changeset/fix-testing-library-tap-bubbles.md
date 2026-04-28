---
"@lynx-js/react": patch
---

Default `fireEvent` to `bubbles: true` for the TouchEvent family in testing-library to match Lynx runtime semantics, and stop reassigning the read-only `Event.prototype` accessors which threw `TypeError` in strict mode.
