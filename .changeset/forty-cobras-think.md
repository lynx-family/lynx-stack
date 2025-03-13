---
"@lynx-js/web-worker-rpc": patch
"@lynx-js/web-constants": patch
---

feat: `createRpcEndpoint` adds a new parameter: `hasReturnTransfer`.

When `isSync`: false, `hasReturn`: true, you can add `transfer` to the callback postMessage created.

At this time, the return value structure of register-handler is changed: `{ data: unknown; transfer: Transferable[]; } | Promise<{ data: unknown; transfer: Transferable[];}>`.
