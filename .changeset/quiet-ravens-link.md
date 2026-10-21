---
"create-lynx-library": patch
---

Exclude link-only PrimJS Node-API runtime libraries from generated Android
library AARs so host packaging keeps the single transitive PrimJS copy.
