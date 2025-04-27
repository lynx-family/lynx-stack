# 使用静态资源

Rspeedy 支持使用包括图片、字体、音频和视频等多种静态资源。

:::tip 什么是静态资源
静态资源是指 Web 应用中不会发生变化的文件。常见的静态资源包括图片、字体、视频、样式表和 JavaScript 文件。这些资源通常存储在服务器或 CDN 上，当用户访问 Web 应用时会被传送到用户的浏览器。由于它们不会发生变化，静态资源可以被浏览器缓存，从而提高 Web 应用的性能。
:::

## 使用 import 引入静态资源

你可以直接在 JavaScript 中导入静态资源：

<!-- eslint-disable import/no-unresolved, import/export -->

```jsx
// Import the logo.png image in the static directory
import logo from './static/logo.png';

function App() {
  return <image src={logo} />; // Can be directly used in ReactLynx
}
```

导入的结果将是表示静态资源的 URL 字符串，并且该资源会被输出到输出文件夹。

也可以在 CSS 文件中使用静态资源：

```css
.logo {
  background-image: url("../static/logo.png");
}
```

### URL 前缀

导入资源后返回的 URL 会自动包含路径前缀：

- 启动开发服务器时，使用 [`dev.assetPrefix`] 来指定路径前缀。
- 进行生产构建时，使用 [`output.assetPrefix`] 来指定路径前缀。

例如，将 `output.assetPrefix` 设置为 `https://example.com`：

<!-- eslint-disable import/no-unresolved, import/export -->

```js
import logo from './static/logo.png';

console.log(logo); // "https://example.com/assets/logo.6c12aba3.png"
```

### Public 目录

项目根目录下的 public 文件夹可以用来放置一些静态资源。这些资源不会被 Rspeedy 打包。

- 启动开发服务器时，这些资源会被托管在 `/` 根路径下。
- 进行生产构建时，这些资源将会被复制到输出目录。

在 JavaScript 代码中，你可以通过 `process.env.ASSET_PREFIX` 拼接这些资源的 URL：

```js
const logoURL = `${process.env.ASSET_PREFIX}/logo.png`;
```

:::warning

- 请避免在源代码中通过 import 来引用 `public` 目录下的文件，正确的方式是通过 URL 引用。
- 通过 URL 引用 `public` 目录中的资源时，请使用绝对路径，而不是相对路径。
- 在生产环境构建过程中，`public` 目录中的文件将会被拷贝到构建产物目录（默认为 `dist`）下，请注意不要和产物文件出现名称冲突。当 `public` 下的文件和产物重名时，构建产物具有更高的优先级，会覆盖 `public` 下的同名文件。

:::

### 类型定义

当你在 TypeScript 代码中引用静态资源时，TypeScript 可能会提示该模块缺少类型定义：

```
TS2307: Cannot find module './static/logo.png' or its corresponding type declarations.
```

此时你需要为静态资源添加类型声明文件，请在项目中创建 `src/rspeedy-env.d.ts` 文件，并添加相应的类型声明。

```typescript title=src/rspeedy-env.d.ts
/// <reference types="@lynx-js/rspeedy/client" />
```

:::tip
[`create-rspeedy`](https://npmjs.com/create-rspeedy) will automatically create this file for you.
:::

## 内联静态资源

内联静态资源是将静态资源的内容直接包含在 JS 输出中，而不是链接到外部文件。这种做法可以通过减少 Lynx 加载应用程序时所需的 HTTP 请求数量来提高 Lynx 应用程序的性能。

然而，内联静态资源也有一些缺点，例如增加单个文件的大小，这可能导致加载速度变慢。因此，在实际场景中，需要根据具体情况决定是否使用内联静态资源。

### 自动内联

当文件大小小于某个阈值（默认是 2KiB）时，Rspeedy 会对资源进行内联处理。内联时，资源将被转换为 base64 编码的字符串，并且不会再发送单独的 HTTP 请求。当文件大小大于该阈值时，会作为一个单独的文件加载，并发送单独的 HTTP 请求。

可以通过 [`output.dataUriLimit`] 配置来修改该阈值。

例如，将图片的阈值设置为 5000 字节，并设置媒体资源不进行内联：

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

### 强制内联

你可以通过在导入资源时添加 `inline` 参数，强制将资源进行内联处理，无论该资源的大小是否小于大小阈值。

<!-- eslint-disable import/no-unresolved -->

```js
import img from './foo.png?inline';

console.log(img); // "data:image/png;base64,iVBORw0KGgo..."
```

在上面的例子中，不论 `foo.png` 的大小如何，它一定会被内联至 JavaScript 产物中。

### 强制不内联

当你希望始终将某些资源视为单独的文件，无论资源有多小时，可以添加 `url` 参数以强制资源不进行内联处理。

<!-- eslint-disable import/no-unresolved -->

```js
import img from '. /foo.png?url';

console.log(img); // "/static/foo.fe0bb4d0.png"
```

在上面的例子中，不论 `foo.png` 的大小如何，它一定不会被内联至 JavaScript 产物中，而是作为一个单独的文件输出。

## 扩展静态资源类型

如果内置资源类型不能满足你的需求，你可以通过 [`source.assetsInclude`] 配置项指定需要被视为静态资源的额外文件类型。

例如，如果你希望将 `*.pdf` 文件视为资源并直接输出到 `dist` 目录，可以添加以下配置：

```ts title="lynx.config.ts"
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  source: {
    assetsInclude: /\.pdf$/,
  },
});
```

添加上述配置后，你可以在代码中导入 \*.pdf 文件，例如：

<!-- eslint-disable import/no-unresolved -->

```js
import myFile from './static/myFile.pdf';

console.log(myFile); // "/static/myFile.6c12aba3.pdf"
```

有关资源模块的更多信息，请参考 [Rspack - 资源模块](https://rspack.dev/guide/features/asset-module)。

[`dev.assetPrefix`]: ../../api/rspeedy.dev.assetprefix
[`output.assetPrefix`]: ../../api/rspeedy.output.assetprefix
[`output.dataUriLimit`]: ../../api/rspeedy.output.dataurilimit
[`tools.rspack`]: ../../api/rspeedy.tools.rspack
[`source.assetsInclude`]: ../../api/rspeedy.source.assetsinclude
