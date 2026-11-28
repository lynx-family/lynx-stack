---
"@lynx-js/web-core": patch
---

Fix `<lynx-view>` hanging at startup when the main-thread iframe's ready message arrived while `event.source === iframe.contentWindow` was still `false`. The ready handshake is now correlated with a per-realm token instead.
