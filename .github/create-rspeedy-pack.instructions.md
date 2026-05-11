---
applyTo: "packages/rspeedy/create-rspeedy/package.json"
---

When maintaining the `create-rspeedy` package `files` list under pnpm 11, include template directories with `template-*/**`; a bare `template-*` only packs the matched directory entries and can omit nested template files from the published tarball.
