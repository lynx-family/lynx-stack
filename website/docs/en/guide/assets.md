# Static Assets

Powered by Rsbuild, Rspeedy supports using static assets, including images, fonts, audios and videos.

:::tip What is Static Assets
Static assets are files that are part of a Lynx application and do not change, even when the application is being used.

Examples of static assets include images, fonts, medias, stylesheets, and JavaScript files. These assets are typically stored on a web server or CDN, and delivered to the users when the Lynx application is accessed.

Because they do not change, static assets can be cached by the App, which helps to improve the performance of the Lynx application.
:::

## Import Assets

You can directly import static assets in JavaScript:

<!-- eslint-disable import/no-unresolved, import/export -->

```jsx
// Import the logo.png image in the static directory
import logo from './static/logo.png';

function App() {
  return <image src={logo} />; // Can be directly used in ReactLynx
}
```

The result of the import will be a URL string that represent the static asset. And the asset will be emitted to the output folder.

You can also use static assets in CSS:

```css
.logo {
  background-image: url("../static/logo.png");
}
```

### URL Prefix

The URL returned after importing a asset will automatically include the path prefix:

- In development, using [`dev.assetPrefix`](../api/rspeedy.dev.assetprefix.md) to set the path prefix.
- In production, using [`output.assetPrefix`](../api/rspeedy.output.assetprefix.md) to set the path prefix.

For example, you can set `output.assetPrefix` to `https://example.com`:

<!-- eslint-disable import/no-unresolved, import/export -->

```js
import logo from './static/logo.png';

console.log(logo); // "https://example.com/static/logo.6c12aba3.png"
```

### Public Folder

The `public` folder at the project root can be used to place some static assets. These assets will not be bundled by Rspeedy.

- When you start the dev server, these assets will be served under the root path, `/`.
- When you perform a production build, these assets will be copied to the output directory.

In JavaScript code, you can splice the URL via `process.env.ASSET_PREFIX`:

```js
const logoURL = `${process.env.ASSET_PREFIX}/logo.png`;
```

:::warning

- Avoid importing files from the public folder into your source code, instead reference them by URL.
- When referencing resources in the public folder via URL, please use absolute paths instead of relative paths.
- During the production build, the files in public folder will be copied to the output folder (default is `dist`). Please be careful to avoid name conflicts with the output files. When files in the `public` folder have the same name as outputs, the outputs have higher priority and will overwrite the files with the same name in the `public` folder.

:::

### Type Declaration

When you import static assets in TypeScript code, TypeScript may prompt that the module is missing a type definition:

```
TS2307: Cannot find module './static/logo.png' or its corresponding type declarations.
```

To fix this, you need to add a type declaration file for the static assets, please create a `src/rspeedy-env.d.ts` file, and add the corresponding type declaration.

```typescript title=src/rspeedy-env.d.ts
/// <reference types="@lynx-js/rspeedy/client" />
```

:::tip
[`create-rspeedy-app`](./installation.mdx#create-rspeedy-app) will automatically create this file for you.
:::

## Inline Assets

Inline static assets refer to the practice of including the content of a static asset directly in the JS output, instead of linking to an external file. This can improve the performance of a Lynx application by reducing the number of HTTP requests that Lynx has to make to load the application.

However, static assets inlining also has some disadvantages, such as increasing the size of a single file, which may lead to slower loading. Therefore, in the actual scenario, it is necessary to decide whether to use static assets inlining according to the specific situation.

### Automatic Inlining

Rspeedy will inline assets when the file size of is less than a threshold (the default is 2KiB). When inlined, the asset will be converted to a base64-encoded string and will no longer send a separate HTTP request. When the file size is greater than this threshold, it is loaded as a separate file with a separate HTTP request.

The threshold can be modified with the [`output.dataUriLimit`](../api/rspeedy.output.dataurilimit.md) config.

For example, set the threshold of images to 5000 bytes, and set media assets not to be inlined:

```ts title="lynx.config.ts"
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  output: {
    dataUriLimit: {
      image: 5000,
      media: 0,
    },
  },
});
```

### Force Inlining

You can force an asset to be inlined by adding the `inline` query when importing the asset, regardless of whether the asset's size is smaller than the size threshold.

<!-- eslint-disable import/no-unresolved -->

```js
import img from './foo.png?inline';

console.log(img); // "data:image/png;base64,iVBORw0KGgo..."
```

In the above example, the `foo.png` image will always be inlined, regardless of whether the size of the image is larger than the threshold.

### Force No Inlining

When you want to always treat some assets as separate files, no matter how small the asset is, you can add the `url` query to force the asset not to be inlined.

<!-- eslint-disable import/no-unresolved -->

```js
import img from '. /foo.png?url';

console.log(img); // "/static/foo.fe0bb4d0.png"
```

In the above example, the `foo.png` image will always be loaded as a separate file, even if the size of the image is smaller than the threshold.

## Extend Asset Types

If the built-in asset types in Rsbuild cannot meet your requirements, you can modify the built-in Rspack configuration and extend the asset types you need using [`tools.rspack`](../api/rspeedy.tools.rspack.md).

For example, if you want to treat `*.pdf` files as assets and directly output them to the dist directory, you can add the following configuration:

```ts title="lynx.config.ts"
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  tools: {
    rspack(config, { addRules }) {
      addRules([
        {
          test: /\.pdf$/,
          // converts asset to a separate file and exports the URL address.
          type: 'asset/resource',
        },
      ]);
      return config;
    },
  },
});
```

After adding the above configuration, you can import `*.pdf` files in your code, for example:

<!-- eslint-disable import/no-unresolved -->

```js
import myFile from './static/myFile.pdf';

console.log(myFile); // "/static/myFile.6c12aba3.pdf"
```

For more information about asset modules, please refer to [Rspack - Asset modules](https://rspack.dev/guide/features/asset-module).
