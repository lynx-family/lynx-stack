---
"@lynx-js/web-core": patch
---

Stop redeclaring `fetch` as a chunk-scope binding. Reusing the host
`window.fetch` from BTS chunks (instead of capturing the no-op stub the
chunk wrapper used to install) lets the renderer issue real network
requests.
