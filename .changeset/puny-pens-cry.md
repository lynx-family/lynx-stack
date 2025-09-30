---
"@lynx-js/web-worker-runtime": patch
"@lynx-js/web-constants": patch
"@lynx-js/web-core": patch
---

feat: support load bts chunk from remote address

- re-support chunk splitting
- support lynx.requireModule with a json file
- support lynx.requireModule, lynx.requireModuleAsync with a remote url
- support to add a breakpoint in chrome after reloading the web page
