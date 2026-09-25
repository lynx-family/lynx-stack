---
"@lynx-js/web-core": minor
---

Implement `lynx.accessibilityAnnounce()` on web. Content passed to it is now
announced to screen readers via a visually-hidden `aria-live="assertive"`
region owned by the main thread (where the LynxView's DOM actually lives).

Closes the web platform gap tracked by
`lynx-api/lynx/accessibilityAnnounce` in `lynx-compat-data`.
