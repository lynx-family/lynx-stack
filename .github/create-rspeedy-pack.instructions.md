---
applyTo: "packages/rspeedy/create-rspeedy/**"
---

When maintaining the `create-rspeedy` package `files` list under pnpm 11, include template directories with `template-*/**`; a bare `template-*` only packs the matched directory entries and can omit nested template files from the published tarball.

When defining `@rstackjs/create-toolkit` extra tools in `packages/rspeedy/create-rspeedy/src/index.ts`, use the 2.x callback shape for `when`: destructure `({ templateName })` instead of accepting a bare template-name string.
