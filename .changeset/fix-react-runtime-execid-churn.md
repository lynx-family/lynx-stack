---
"@lynx-js/react": patch
---

fix: reduce redundant updates for main-thread handlers and gestures

- Updates are faster when the main-thread event handler or gesture object is stable across rerenders (fewer unnecessary native updates).
- Spread props rerenders that don't semantically change the handler/gesture no longer trigger redundant updates.
- Removing a gesture from spread props reliably clears the gesture state on the target element.
