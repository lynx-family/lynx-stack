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

That the two produce the same bundle is covered by a test, in
`@lynx-js/react-rsbuild-plugin`.
