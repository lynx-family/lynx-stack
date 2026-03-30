---
"@lynx-js/web-core": patch
---

feat(web-core): add `is_bubble` parameter to `common_event_handler` to properly handle non-bubbling events like `window.Event('click', { bubbles: false })`.
