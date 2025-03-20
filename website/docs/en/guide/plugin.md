# Plugin

Rsbuild provides a powerful plugin system that allows for user extension.
Rspeedy leverages this plugin system directly.

Plugins written by developers can modify the default behavior of Rspeedy/Rsbuild and add various additional features, including but not limited to:

- Register lifecycle hooks
- Transform module source code
- Modify Rsbuild configuration
- Modify Rspack configuration

## Find Plugins

Before finding plugin, you may want to check if the feature you want is already included in [Rspeedy Configuration](/api/rspeedy).

### Official Plugins

The following official plugins are maintained by Lynx team.

- [QR code Plugin](/api/qrcode-rsbuild-plugin): Use QR code with Rspeedy.

:::tip
You can find the source code of all official plugins in [lynx-stack](https://github.com/lynx-family/lynx-stack/packages/rspeedy).
:::

### Rsbuild Plugins

The following Rsbuild plugins can be used in Rspeedy.

- [Sass Plugin](https://rsbuild.dev/plugins/list/plugin-sass): Use Sass as the CSS preprocessor.
- [Less Plugin](https://rsbuild.dev/plugins/list/plugin-less): Use Less as the CSS preprocessor.
- [ESLint Plugin](https://github.com/rspack-contrib/rsbuild-plugin-eslint): Run ESLint checks during the compilation.
- [Type Check Plugin](https://github.com/rspack-contrib/rsbuild-plugin-type-check): Run TypeScript type checker on a separate process.
- [Image Compress Plugin](https://github.com/rspack-contrib/rsbuild-plugin-image-compress): Compress the image assets.
- [Typed CSS Modules Plugin](https://github.com/rspack-contrib/rsbuild-plugin-typed-css-modules): Generate TypeScript declaration file for CSS Modules.

### Rspack/Webpack Plugins

The following Rspack/Webpack plugins can be used in Rspeedy.

:::info
Rspack/Webpack plugins should be placed in [`tools.rspack.plugins`].
:::

- [BannerPlugin]: Add a banner to the top or bottom of the output.
- [EnvironmentPlugin]: Use `process.env` with [DefinePlugin].
- [ProvidePlugin]: Automatically load modules instead of having to `import` them everywhere.

## Write Plugins

If none of the existing ecosystem plugins meet your requirements, you might consider writing your own plugin.

### Rsbuild Plugin API

See [Rsbuild - Plugin Hooks](https://rsbuild.dev/plugins/dev/hooks) for more details.

### Rspack Plugin API

See [Rspack - Compiler Hooks](https://rspack.dev/api/plugin-api/compiler-hooks) and [Rspack - Compilation Hooks](https://rspack.dev/api/plugin-api/compilation-hooks) for more details.

[`tools.rspack.plugins`]: /api/rspeedy.tools.rspack#example-4
[BannerPlugin]: https://rspack.dev/plugins/webpack/banner-plugin
[DefinePlugin]: https://rspack.dev/plugins/webpack/define-plugin
[EnvironmentPlugin]: https://rspack.dev/plugins/webpack/environment-plugin
[ProvidePlugin]: https://rspack.dev/plugins/webpack/provide-plugin
