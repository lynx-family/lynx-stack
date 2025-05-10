# 命令行界面

Rspeedy 提供了一个轻量级的命令行界面（CLI），包含 `dev` 和 `build` 等常用命令。

## 使用全局安装的 Rspeedy

你可以通过 `npx rspeedy` 调用 Rspeedy，但更方便的做法是全局安装以便在 shell 的 `PATH` 中随时可用：

```bash
# 全局安装 Rspeedy
npm install --global @lynx-js/rspeedy
```

:::info 如果全局安装的 Rspeedy 版本不正确怎么办？

与 [Rush](https://rushstack.io/) 类似，Rspeedy 实现了 "版本选择器" 功能，会自动发现本地的 `node_modules` 目录并调用 `./node_modules/.bin/rspeedy`，确保使用正确的版本。
:::

## 使用 Node.js 的 TypeScript 支持

如果你使用的 Node.js 版本支持 TypeScript：

1. Node.js >= v23.6
1. Node.js >= v22.6 使用 [--experimental-strip-types](https://nodejs.org/api/cli.html#--experimental-strip-types)
1. Node.js >= v22.7 使用 [--experimental-transform-types](https://nodejs.org/api/cli.html#--experimental-transform-types)

可以使用 Node.js 内置的 TypeScript 转换功能。

```json title="package.json"
{
  "build": "NODE_OPTIONS=--experimental-transform-types rspeedy build"
}
```

## rspeedy -h

在项目目录中执行以下命令查看所有可用的 CLI 命令：

```bash
rspeedy -h
```

输出示例如下：

```text
➜ rspeedy --help

Usage: rspeedy <command> [options]

Options:
  -V, --version      output the version number
  --unmanaged        Force to use the unmanaged version of Rspeedy, instead of the locally installed.
  -h, --help         display help for command

Commands:
  build [options]    Build the project in production mode
  dev [options]      Run the dev server and watch for source file changes while serving.
  inspect [options]  View the Rsbuild config and Rspack config of the project.
  preview [options]  Preview the production build outputs locally.
  help [command]     display help for command
```

## rspeedy dev

`rspeedy dev` 命令用于启动本地开发服务器并编译源代码。

```text
➜ rspeedy dev --help

Usage: rspeedy dev [options]

Run the dev server and watch for source file changes while serving.

Options:
  --base <base>            specify the base path of the server
  --environment <name...>  specify the name of environment to build
  -c --config <config>     specify the configuration file, can be a relative or absolute path
  --env-mode <mode>        specify the env mode to load the .env.[mode] file
  --no-env                 disable loading `.env` files"
  -m --mode <mode>         specify the build mode, can be `development`, `production` or `none`
  -h, --help               display help for command
```

当配置文件内容发生修改时，开发服务器会自动重启。

## rspeedy build

`rspeedy build` 命令默认会在 `dist/` 目录下生成生产环境构建产物。

```text
➜ rspeedy build --help

Usage: rspeedy build [options]

Build the project in production mode

Options:
  --environment <name...>  specify the name of environment to build
  -c --config <config>     specify the configuration file, can be a relative or absolute path
  --env-mode <mode>        specify the env mode to load the .env.[mode] file
  --no-env                 disable loading `.env` files"
  -m --mode <mode>         specify the build mode, can be `development`, `production` or `none`
  -h, --help               display help for command
```

## rspeedy preview

`rspeedy preview` 命令用于本地预览生产环境构建产物。注意需要先执行 `rspeedy build` 生成构建产物。

```text
➜ rspeedy preview --help

Usage: rspeedy preview [options]

Preview the production build outputs locally.

Options:
  --base <base>         specify the base path of the server
  -c --config <config>  specify the configuration file, can be a relative or absolute path
  --env-mode <mode>     specify the env mode to load the .env.[mode] file
  --no-env              disable loading `.env` files"
  -m --mode <mode>      specify the build mode, can be `development`, `production` or `none`
  -h, --help            display help for command
```

:::tip
preview 命令仅用于本地预览，不要在生产服务器中使用，因其并非为此设计。
:::

## rspeedy inspect

`rspeedy inspect` 命令用于查看项目的 Rspeedy 配置和 Rspack 配置。

```text
➜ rspeedy inspect --help

Usage: rspeedy inspect [options]

View the Rsbuild config and Rspack config of the project.

Options:
  --output <output>     specify inspect content output path
  --verbose             show full function definitions in output
  -c --config <config>  specify the configuration file, can be a relative or absolute path
  --env-mode <mode>     specify the env mode to load the .env.[mode] file
  --no-env              disable loading `.env` files"
  -m --mode <mode>      specify the build mode, can be `development`, `production` or `none`
  -h, --help            display help for command
```

在项目根目录执行 `rspeedy inspect` 命令后，会在项目的 `dist/.rspeedy` 目录下生成以下文件：

- `rspeedy.config.js`: 表示构建时使用的 Rspeedy 配置
- `rsbuild.config.mjs`: 表示构建时使用的 Rsbuild 配置
- `rspack.config.lynx.mjs`: 表示构建时使用的 Rspack 配置

```text
➜ rspeedy inspect

Inspect config succeed, open following files to view the content:

  - Rspeedy Config: /project/dist/.rsbuild/rspeedy.config.mjs
  - Rspack Config (lynx): /project/dist/.rsbuild/rspack.config.lynx.mjs

Inspect Rspeedy config succeed, open following files to view the content:

  - Rspeedy: /Users/colin/rspeedy/examples/react/dist/rspeedy-rspack/.rsbuild/rspeedy.config.js
```

### 指定模式

默认情况下，inspect 命令会输出开发模式的配置。可以通过添加 `--env production` 选项来输出生产模式的配置：

```bash
rspeedy inspect --mode production
```

### 详细输出

默认情况下，inspect 命令会省略配置对象中的函数内容。可以通过添加 `--verbose` 选项来输出完整的函数内容：

```bash
rspeedy inspect --verbose
```
