---
"@lynx-js/web-core": minor
---

feat: support global keyboard events (keydown/keyup) on web

Register `keydown`/`keyup` listeners on `document` instead of the ShadowRoot, which never receives keyboard events. Handle the case where `target_unique_id` is 0 (no element in the Lynx tree) by falling back to `currentTarget`, enabling `global-bindkeydown` and `global-bindkeyup` to work correctly in web previews.
