---
"@lynx-js/react": patch
---

Make `initElementPAPICallAlog` idempotent so the element PAPI alog is not installed twice over the same globals, which logged every call once per layer.
