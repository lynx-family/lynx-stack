---
"@lynx-js/reactlynx-testing-library": patch
---

Default `fireEvent` to `bubbles: true` for the TouchEvent family (`tap`, `longtap`, `touchstart`, `touchmove`, `touchend`, `touchcancel`, `longpress`) to match Lynx runtime semantics, and stop reassigning the read-only `Event.prototype` accessors (`bubbles`/`cancelable`/`composed`) which threw `TypeError` in strict mode.
