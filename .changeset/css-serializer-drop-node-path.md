---
"@lynx-js/css-serializer": patch
---

Drop the `node:path` dependency from `@lynx-js/css-serializer` so the package can
be bundled for browsers.

`parse` imports `generateHref`, which imported `node:path`, and the package
exposes no subpath exports to import around it. That made the whole package
unusable in a browser bundle even for consumers that never touch `@import`
resolution. `generateHref` now uses [`pathe`](https://github.com/unjs/pathe),
which works in both a browser bundle and Node, ships dual ESM/CJS entries and
carries its own types.

**Callers that pass POSIX paths are unaffected.** That includes every in-repo
caller, which relies on the `projectRoot` `'/'` and `filename` `'./index.css'`
defaults. For any input without a backslash, `pathe` is byte-identical to
`path.posix` - which is what `node:path`'s default export already resolved to on
every non-Windows platform - verified against `node:path` itself over a generated
input matrix.

**Inputs containing a backslash resolve differently**, because `pathe`
normalizes Windows paths: `\` is a separator, a drive letter is a root, and
`\\srv\share` is a UNC prefix. For the common Windows shape - a drive-letter or
backslash `projectRoot` with a relative `filename` - this now agrees with what a
Windows build host used to emit, where a pure-POSIX helper would not. It is not a
complete match: UNC roots, a `\`-rooted `filename` and a drive-letter `@import`
still differ, and for a drive-letter `@import` the old Windows output was not a
single value at all. Measured examples:

| `projectRoot` / `filename`    | `@import`           | now                | old, on Windows    | old, on Linux/macOS  |
| ----------------------------- | ------------------- | ------------------ | ------------------ | -------------------- |
| `C:\proj` / `pages\index.css` | `./a.css`           | `/pages/a.css`     | `/pages/a.css`     | `/a.css`             |
| `C:\proj` / `pages\index.css` | `../shared/b.css`   | `/shared/b.css`    | `/shared/b.css`    | `../shared/b.css`    |
| `/` / `./index.css`           | `\a.css`            | `/a.css`           | `/a.css`           | `//a.css`            |
| `/` / `./index.css`           | `\\srv\share\x.css` | `/srv/share/x.css` | `/srv/share/x.css` | `///srv/share/x.css` |
| `/` / `./index.css`           | `C:\x.css`          | `../C:/x.css`      | varies by drive    | `/C:/x.css`          |

That last row had no single value on Windows, and the reason generalizes:
`path.win32.resolve` takes the drive it resolves against from `process.cwd()`, so
whenever no argument names a drive, the old output depended on which drive the
build ran from. `/` with `./index.css` and a `C:\x.css` import resolved to
`/x.css` on a C: build machine but to `/C:/x.css` on a D: or E: one.

So the old behaviour varied not only with the platform but, on Windows, with the
drive letter of the machine that happened to run the build - which is a further
reason to stop using the platform-dependent `node:path` default export here. None
of the rows above reach `pathe`'s working-directory fallback, so each is now a
function of its arguments alone: every `now` value was measured identically on a
Linux host and on simulated C:, D:, E: and UNC ones.

`projectRoot: '//'` is not supported: `pathe` resolves it against
`process.cwd()`, so the emitted href depends on the directory the build ran from.
Every other absolute `projectRoot` is working-directory independent. A relative
`projectRoot` resolves against `process.cwd()` in Node exactly as it did before,
and against `/` in a browser bundle, where there is no `process.cwd()`.

This ships as a `patch` because it fixes browser compatibility without changing
the public API. Under Changesets v3, the out-of-range peer dependency update
also gives `@lynx-js/web-core` a `patch` bump.
