---
applyTo: "packages/rspeedy/plugin-external-bundle/**"
---

Keep `pluginExternalBundle` responsible for expanding built-in externals presets and for Rspeedy-specific dev-server behavior such as serving local external bundles during development. Prefer `externalBundleRoot` as the explicit source directory for project-owned external bundles referenced by `bundlePath`; use it consistently for both development serving and build-time asset emission instead of relying on shared dist directories or ad hoc middleware in examples. Resolve the built-in React preset bundle from the `@lynx-js/react-umd/dev` or `@lynx-js/react-umd/prod` peer dependency instead of reaching into the monorepo with a relative filesystem path, and when the preset uses `bundlePath` rather than an explicit `url`, emit that runtime bundle into the user's build output automatically.
