---
"@lynx-js/template-webpack-plugin": minor
"@lynx-js/css-extract-webpack-plugin": minor
---

Rename the lazy bundle output directory from `async/` to `lazy-bundle/`.

Lazy bundles can now also be loaded synchronously with `import(..., { with: { mode: 'sync' } })`, so the `async/` directory name no longer matches how they are used. The default `lazyBundleFilename` becomes `lazy-bundle/[name].[fullhash].bundle`, and the intermediate outputs move from `.rspeedy/async/<name>/` to `.rspeedy/lazy-bundle/<name>/` accordingly.

Update deployment scripts that reference the `dist/async/` directory to use `dist/lazy-bundle/` instead.

`@lynx-js/css-extract-webpack-plugin` requires `@lynx-js/template-webpack-plugin` `^0.14.0`.
