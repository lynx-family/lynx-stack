# Rsbuild example

The same app as `@lynx-js/example-react`, built with Rsbuild instead of Rspeedy.
The source is the same, without the `@lynx-js/preact-devtools` import.

`pluginReactLynx` applies the Lynx build engine when it is not already there, so
this is the whole plugin list:

```js
[pluginReactLynx()];
```

## Scripts

- `pnpm build` / `pnpm dev` — build or serve through the Rsbuild CLI.
- `pnpm compare` — build this source twice, once through Rspeedy and once
  through Rsbuild, and check that the Lynx bundles are byte-identical.

`compare` turns off `output.filenameHash`, because the chunk content hash is not
stable between builds, including two builds of the same configuration.
