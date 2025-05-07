---
"@lynx-js/react": patch
---

Fixed a race condition when updating states and GlobalProps simultaneously.

This fix prevents the "Attempt to render more than one `<page />`" error from occurring during normal application usage.
