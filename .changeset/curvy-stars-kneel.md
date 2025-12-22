---
"@lynx-js/web-core": patch
---

chore: mark the "multi-thread" deprecated

**NOTICE This will be a breaking change in the future**

mark the thread strategy "multi-thread" as deprecated.

Please use "all-on-ui" instead. If you still want to use multi-thread mode, please try to use a cross-origin isolated iframe.

A console warning will be printed if `thread-strategy` is set to `multi-thread`.
