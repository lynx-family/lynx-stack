---

---

Fix CI flake in `@lynx-js/genui#api-extractor` where the root `tsc` would race a subpackage's `.d.ts` emission and fail with TS7016; the script now waits for each subpackage's declaration file to land on disk before invoking `tsc`.
