---
"@lynx-js/reactlynx-testing-library": patch
---

Align `fireEvent` with Lynx event-propagation semantics:

- `fireEvent.tap` and `fireEvent.longtap` now default to `bubbles: true`, matching the Lynx runtime where `bind`/`catch` listeners fire in the bubble phase. This means an ancestor's `bindtap` will be triggered when you `fireEvent.tap` a descendant — pass `{ bubbles: false }` to opt out.
- `bubbles` / `cancelable` / `composed` are no longer reassigned via `Object.assign` after event construction (they're read-only accessors on `Event.prototype` and would throw `TypeError` in strict mode). They're still applied through the `EventInit` dict.
