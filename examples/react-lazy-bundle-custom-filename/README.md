# @lynx-js/example-react-lazy-bundle-custom-filename

In this example, we show how to customize the output filename of lazy bundles
(async chunks) with a small Rsbuild plugin.

By default, lazy bundles are emitted to `async/[name].[fullhash].bundle`. The
[`pluginLazyBundleFilename`](./plugins/pluginLazyBundleFilename.ts) plugin in
this example overrides that to
`my-lazy-bundles/[name].[fullhash]-<gitCommitHash>.bundle`, where the short git
commit hash is resolved at config time so every lazy bundle is traceable back to
a commit.

## How it works

`@lynx-js/react-rsbuild-plugin` creates one `LynxTemplatePlugin` per entry
inside an async `modifyBundlerChain`, so those plugin instances are not visible
to a plain `modifyBundlerChain` callback. The plugin instead hooks into
`modifyRspackConfig`, which runs after the bundler chain is resolved into a
config but before the plugins' `apply()` is called, and mutates the
`lazyBundleFilename` option on every `LynxTemplatePlugin` instance.

See [`lynx.config.ts`](./lynx.config.ts) for how the plugin is wired up — it
must be placed **after** `pluginReactLynx`.

## Usage

```bash
pnpm build
pnpm dev
```

After `pnpm build`, the lazy bundles are emitted under `dist/my-lazy-bundles/`
(instead of the default `dist/async/`), with the short git commit hash appended
to each filename.
