---
"@lynx-js/css-serializer": patch
---

Point `@lynx-js/source-field` at `src/index.ts`, so a bundler in this repo can
resolve the package without waiting for its `dist/`.

`@lynx-js/css-serializer` has no `build` script - its `dist/` is emitted by the
repository's root `tsc --build`, which is a separate turbo task with no ordering
relationship to any package's `build`. That was invisible while every consumer
was itself type-checked rather than bundled, but `@lynx-js/web-core` bundles its
client with rspack, and rspack resolving `main: dist/index.js` before the root
build has emitted it fails outright.

`@rsbuild/plugin-source-build` is already how this repository answers that -
`@lynx-js/web-elements` and `@lynx-js/web-worker-rpc` declare the same field and
are consumed straight from source. Declaring it here removes the ordering
question rather than scheduling around it.

The field is inert outside such a build: it is a plain, unknown top-level
`package.json` key, so no `exports` map is introduced and no existing entry point
or deep import changes.
