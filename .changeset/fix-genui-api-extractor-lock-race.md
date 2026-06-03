---

---

Fix CI flake in `@lynx-js/genui#api-extractor` caused by a TOCTOU bug in `acquireLock` that let two concurrent invocations of `run-api-extractor.mjs` both enter the critical section; one would `rslib build` the subpackage dist while the other's tsc was reading it, producing TS7016 ("Could not find a declaration file"). The lock now waits on read/parse failures instead of deleting the file, since an unparseable lock usually means the holder is mid-write between `open(wx)` and `writeFile`.
