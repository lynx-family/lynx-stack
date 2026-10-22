---
'@lynx-js/react': patch
---

Keep synchronous lazy import chains from changing unrelated Promise callbacks to run synchronously when the Lynx Promise polyfill caches fulfilled primitive values. This prevents a lazy component's mount effect from re-entering when it updates a parent component.
