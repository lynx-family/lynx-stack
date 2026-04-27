---
"@lynx-js/reactlynx-testing-library": patch
---

Align `fireEvent` with Lynx event-propagation semantics:

- `fireEvent.tap`, `fireEvent.longtap`, and `fireEvent.touchstart` / `touchmove` / `touchend` / `touchcancel` now default to `bubbles: true`, matching the Lynx runtime where these events propagate through capture/bubble phases. An ancestor's `bindtap` (or `bindtouchstart`, etc.) will be triggered when you fire the event on a descendant — pass `{ bubbles: false }` to opt out. Other events (`bgload`, `transitionend`, lifecycle events, etc.) keep their non-bubbling behavior, which mirrors Lynx where only TouchEvent-family events have capture/bubble phases.
- `bubbles` / `cancelable` / `composed` are no longer reassigned via `Object.assign` after event construction (they're read-only accessors on `Event.prototype` and would throw `TypeError` in strict mode). They're still applied through the `EventInit` dict.
