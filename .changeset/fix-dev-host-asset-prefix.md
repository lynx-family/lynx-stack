---
"@lynx-js/rspeedy": patch
---

Fix dev server host resolution for generated asset prefixes.

Rspeedy now falls back from IPv4 to IPv6 when resolving the default dev host, keeps the configured server host when no local IP is found, and applies `server.host` updates from other plugins to the final dev asset prefix.
