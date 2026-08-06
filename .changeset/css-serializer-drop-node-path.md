---
"@lynx-js/css-serializer": patch
---

Drop the `node:path` dependency from `@lynx-js/css-serializer` so the package can
be bundled for browsers.

`parse` imports `generateHref`, which imported `node:path`, and the package
exposes no subpath exports to import around it. That made the whole package
unusable in a browser bundle even for consumers that never touch `@import`
resolution. `generateHref` now uses a small internal POSIX path helper instead.

`node:path`'s default export is already `path.posix` on every non-Windows
platform, so href resolution is unchanged for any absolute `projectRoot` -
verified against `node:path` itself over a generated input matrix. Two
behaviours intentionally differ:

- A relative `projectRoot` no longer resolves against `process.cwd()`. It is
  treated as rooted, making the output a pure function of the arguments rather
  than of the directory the build ran from. `parse` defaults `projectRoot` to
  `'/'`.
- On Windows, resolution now uses POSIX semantics rather than `path.win32`, so
  hrefs no longer vary by platform.
