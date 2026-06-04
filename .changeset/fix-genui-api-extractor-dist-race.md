---

---

Fix a flaky CI failure in genui API extraction where `@lynx-js/genui-cli`'s `tsc` (and `@lynx-js/genui#api-extractor`) could fail with `TS2307` / `TS7016` ("Cannot find module `@lynx-js/genui-a2ui-prompt`"). `run-api-extractor.mjs` rebuilt each package in-script (`pnpm run build`), rewriting its `dist/` while turbo-scheduled consumer builds read the same `dist/`, so `tsc` could observe `index.js` without its freshly-cleaned `index.d.ts`. The script no longer builds — turbo's task graph builds each package, and the api-extractor task now depends on the package build for the rust-free genui packages — and the file lock that only existed to serialize those in-script builds is removed.
