# Rspeedy example

The same app as `@lynx-js/example-react`, built with Rspeedy instead of the
Rsbuild CLI. Every other example uses Rsbuild directly; this one keeps the
Rspeedy CLI covered.

Rspeedy applies the Lynx build engine itself, so the plugin list stays the
same as an Rsbuild config's:

```js
[pluginReactLynx()];
```

## Scripts

- `pnpm build` / `pnpm dev` — build or serve through the Rspeedy CLI.
