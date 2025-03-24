---
"@lynx-js/rspeedy": patch
---

Support `server.strictPort`

When a port is occupied, Rspeedy will automatically increment the port number until an available port is found.

Set strictPort to true and Rspeedy will throw an exception when the port is occupied.
