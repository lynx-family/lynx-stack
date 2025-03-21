# 构建输出文件

本章将介绍输出文件的目录结构以及如何控制不同类型文件的输出路径。

## 默认目录结构

以下是基本的输出目录结构。默认情况下，编译后的文件会输出到当前项目的 `dist` 目录中。

### 生产环境

生产环境下，`dist/` 目录包含所有需要部署的文件。

```tree
dist/
├── [name].lynx.bundle
├── async
│   └── [name].lynx.bundle
└── static
    ├── image
    │   └── [name].[hash].png
    ├── svg
    │   └── [name].[hash].svg
    └── js
        ├── [id].[hash].js
        │   └── async
        │       └── [id].[hash].js
        └── lib-preact.[hash].js
```

最常见的输出文件包括 Bundle 文件、JS 文件和静态资源：

- Bundle（`[name].lynx.bundle`），可通过 [`output.filename.bundle`] 配置
- 异步 Bundle（`async/[name].lynx.bundle`）
- JS 文件（`static/js/*.js`），可通过 [`output.distPath.js`] 和 [`output.filename.js`] 配置
- 静态资源目录（`static/{font,image,media,svg}`）

文件名中的占位符含义：

- `[name]` 表示入口名称（如 `index`、`main`）
- `[hash]` 是基于文件内容生成的哈希值
- `[id]` 是 Rspack 内部 chunk ID

### 开发环境

开发环境下会生成 `dist/.rspeedy` 目录用于调试：

```tree
dist/
├── .rspeedy
│   ├── async
│   │   └── [name]
│   │       ├── debug-info.json
│   │       ├── tasm.json
│   │       └── [name].css
│   ├── [name]
│   │   ├── background.js
│   │   ├── background.js.map
│   │   ├── debug-info.json
│   │   ├── [name].css
│   │   ├── main-thread.js
│   │   ├── main-thread.js.map
│   │   └── tasm.json
│   └── rspeedy.config.js
├── [name].lynx.bundle
└── static
    ├── image
    │   ├── [name].[hash].png
    │   └── [name].[hash].svg
    └── js
        ├── [id].[hash].js
        │   └── async
        │       ├── [id].[hash].js
        │       └── [id].[hash].js.map
        ├── lib-preact.[hash].js
        └── lib-preact.[hash].js.map
```

开发环境额外生成的文件包括：

- 后台线程脚本（Background Thread Script）：内联到 Bundle 中的脚本，默认输出到 `.rspeedy/[name]/background.js`
- 主线程脚本（MainThread Thread Script）：默认输出到 `.rspeedy/[name]/main-thread.js`
- Source Map 文件：与 JS 文件同目录，以 `.map` 为后缀

## 修改目录结构

Rspeedy 提供以下配置项来调整输出目录：

- 通过 [`output.filename`] 修改文件名
- 通过 [`output.distPath`] 修改输出路径
- 通过 [`output.legalComments`] 配置许可声明文件
- 通过 [`output.sourceMap`] 配置 Source Map 文件

## 扁平化目录

若需要简化目录层级，可将目录配置设为空字符串来实现扁平化结构：

```js
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  output: {
    distPath: {
      js: '',
    },
    filename: {
      bundle: '[name].lynx.bundle',
    },
  },
});
```

上述配置将生成以下结构：

```bash
dist
├── [id].[hash].js
├── [id].[hash].js.map
└── [name].lynx.bundle
```

[`output.filename`]: ../../api/rspeedy.output.filename
[`output.filename.js`]: ../../api/rspeedy.filename.js
[`output.filename.bundle`]: ../../api/rspeedy.filename.bundle
[`output.distPath`]: ../../api/rspeedy.output.distpath
[`output.distPath.js`]: ../../api/rspeedy.distpath.js
[`output.legalComments`]: ../../api/rspeedy.output.legalcomments
[`output.sourceMap`]: ../../api/rspeedy.output.sourcemap
