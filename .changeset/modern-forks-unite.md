---
"@lynx-js/web-mainthread-apis": patch
"@lynx-js/web-constants": patch
"@lynx-js/web-core": patch
---

fix: some valus should be updateable by global scope

Now we add an allowlist to allow some identifiers could be updated by globalThis.

For those values in the allowlist:

```
globalThis.foo = 'xx';
console.log(foo); //'xx'
```
