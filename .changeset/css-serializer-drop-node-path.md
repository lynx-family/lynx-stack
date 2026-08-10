---
"@lynx-js/css-serializer": patch
---

Drop the `node:path` dependency from `@lynx-js/css-serializer` so the package can
be bundled for browsers.

`parse` imports `generateHref`, which imported `node:path`, and the package
exposes no subpath exports to import around it. That made the whole package
unusable in a browser bundle even for consumers that never touch `@import`
resolution. `generateHref` now uses `path-browserify`, which is Node's own POSIX
`path` implementation ported verbatim and works in both a browser bundle and
Node.

`node:path`'s default export is already `path.posix` on every non-Windows
platform, so href resolution is unchanged for any absolute `projectRoot` -
verified against `node:path` itself over a generated input matrix. One behaviour
intentionally differs:

- On Windows, resolution now uses POSIX semantics rather than `path.win32`, so
  hrefs no longer vary by platform. **This changes emitted `@import` hrefs for
  consumers that pass native Windows paths.** Measured examples, with
  `projectRoot` `C:\proj` and `filename` `pages\index.css`:

  | `@import`         | before (on Windows) | after (all platforms) |
  | ----------------- | ------------------- | --------------------- |
  | `./a.css`         | `/pages/a.css`      | `/a.css`              |
  | `../shared/b.css` | `/shared/b.css`     | `../shared/b.css`     |

  Callers that pass POSIX paths - including every in-repo caller, which relies on
  the `filename` `'./index.css'` and `projectRoot` `'/'` defaults - are
  unaffected on every platform.

  This ships as a patch despite changing behaviour on one platform. The package
  is a `peerDependency` of `@lynx-js/web-core`, so a minor here cascades that
  package to `1.0.0`, which `.github/scripts/check-no-major-changeset.cjs`
  rejects.

A relative `projectRoot` keeps resolving against `process.cwd()` in Node, exactly
as before, because `path-browserify` is a faithful port. Note that a browser
bundle has no `process.cwd()` and falls back to treating the path as rooted, so
only an **absolute** `projectRoot` resolves identically in both environments.
`parse` defaults `projectRoot` to `'/'` and every in-repo caller passes an
absolute one.
