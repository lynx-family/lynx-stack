# 插件

Rsbuild 提供了一套强大的插件系统，允许用户进行功能扩展。Rspeedy 直接继承了这套插件系统。

开发者编写的插件可以修改 Rspeedy/Rsbuild 的默认行为，并添加各种附加功能，包括但不限于：

- 注册生命周期钩子
- 转换模块源代码
- 修改 Rsbuild 配置
- 修改 Rspack 配置

## 查找插件

在寻找插件之前，建议先查看所需功能是否已包含在 [Rspeedy 配置](../../api/rspeedy.md)中。

### Rsbuild 插件

以下 Rsbuild 插件可直接在 Rspeedy 中使用：

- [Sass 插件](https://rsbuild.dev/plugins/list/plugin-sass): 使用 Sass 作为 CSS 预处理器
- [Less 插件](https://rsbuild.dev/plugins/list/plugin-less): 使用 Less 作为 CSS 预处理器
- [ESLint 插件](https://github.com/rspack-contrib/rsbuild-plugin-eslint): 在编译过程中执行 ESLint 检查
- [TypeScript 类型检查插件](https://github.com/rspack-contrib/rsbuild-plugin-type-check): 在独立进程中进行 TypeScript 类型检查
- [图片压缩插件](https://github.com/rspack-contrib/rsbuild-plugin-image-compress): 压缩图片资源
- [Typed CSS Module 插件](https://github.com/rspack-contrib/rsbuild-plugin-typed-css-modules): 为 CSS Modules 生成 TypeScript 声明文件
- [Tailwind CSS 插件](https://github.com/rspack-contrib/rsbuild-plugin-tailwindcss): 接入 Tailwind CSS V3

### Rspack/Webpack 插件

以下 Rspack/Webpack 插件可在 Rspeedy 中使用：

:::info
Rspack/Webpack 插件需要配置在 [`tools.rspack.plugins`] 中
:::

- [Banner 插件]：在输出文件顶部或底部添加注释
- [Environment 插件]：通过 [Define 插件]使用 `process.env`
- [Provide 插件]：自动加载模块，无需手动导入

## 编写插件

如果现有生态中的插件无法满足需求，可以考虑自行编写插件。

### Rsbuild 插件 API

详见 [Rsbuild - 插件钩子](https://rsbuild.dev/plugins/dev/hooks)

### Rspack 插件 API

详见 [Rspack - Compiler 钩子](https://rspack.dev/api/plugin-api/compiler-hooks)和 [Rspack - Compilation 钩子](https://rspack.dev/api/plugin-api/compilation-hooks)

[`tools.rspack.plugins`]: ../../api/rspeedy.tools.rspack#example-4
[Banner 插件]: https://rspack.dev/plugins/webpack/banner-plugin
[Define 插件]: https://rspack.dev/plugins/webpack/define-plugin
[Environment 插件]: https://rspack.dev/plugins/webpack/environment-plugin
[Provide 插件]: https://rspack.dev/plugins/webpack/provide-plugin
