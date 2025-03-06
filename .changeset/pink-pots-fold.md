---
"@lynx-js/web-mainthread-apis": patch
"@lynx-js/web-core": patch
---

refactor: isolate the globalThis in mts

After this commit, developers' mts code won't be able to access the globalThis

The following usage will NOT work

```
globalThis.foo = () =>{};
foo();//crash
```
