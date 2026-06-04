---
"@lynx-js/genui-a2ui-prompt": patch
---

Avoid a CI flake where `pnpm turbo api-extractor` panics in rspack's
filesystem storage with `Transaction already in progress` by serializing
the per-package `build:api` after `build`. Both scripts invoke
`rslib build` and write to the same
`node_modules/.cache/rspack/<hash>/.temp` directory, so when turbo runs
them concurrently rspack's transaction lock aborts one of them
(SIGABRT / exit 134).
