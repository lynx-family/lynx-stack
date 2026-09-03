---
"@lynx-js/react": minor
---

`withDefaultConfig` from `@lynx-js/react/testing-library/rstest-config` now
applies the ReactLynx transform and the module aliases the testing environment
needs, so a library project no longer has to wire a bundler plugin itself.

The transform runs in `mode: 'test'` with a `MIXED` target, so a single bundle
drives both the main and the background thread — what the testing library's
dual-thread environment expects. It deliberately does not go through
`@lynx-js/react-rsbuild-plugin`: that transitively depends on
`use-sync-external-store`, which would make a build cycle out of that package's
own tests, and it compiles the two threads as separate layers.

Aliasing every `preact` subpath to the single copy shipped with
`@lynx-js/react` keeps one `options` singleton; with two copies, hooks register
`_render` on one while the diff path reads the other and `useState` throws
`Cannot read properties of undefined (reading '__H')`.

New options on `withDefaultConfig`:

- `rootPath` — the directory of your `rstest.config.ts`. Snapshot and worklet
  ids hash from module paths relative to it, so pinning it keeps those ids
  stable whether the project runs on its own or as one entry of a root
  `projects` list.
- `engineVersion` — engine version passed to the transform.
- `experimental_enableReactCompiler` — run `babel-plugin-react-compiler` ahead
  of the transform.

`withLynxConfig` is unchanged: it keeps deriving its configuration from your
`lynx.config.ts` through the Rsbuild adapter. The Vitest entry points are
unchanged.
