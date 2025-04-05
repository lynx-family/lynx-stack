# CLI

Rspeedy comes with a lightweight CLI that includes commands such as `dev` and `build`.

## Using the global Rspeedy version

You can invoke Rspeedy using `npx rspeedy`, but it's more convenient to also install it globally so that it's always available in your shell `PATH`:

```bash
# Install the Rspeedy globally
npm install --global @lynx-js/rspeedy
```

:::info What if the globally installed Rspeedy binary is the wrong version?

Just like [Rush](https://rushstack.io/), Rspeedy implements a "version selector" feature that will automatically discover your local `node_modules` folder and invoke `./node_modules/.bin/rspeedy`, ensuring that the correct version is used.
:::

## Using Node.js TypeScript support

If the version of Node.js you are using supports TypeScript:

1. Node.js >= v23.6
1. Node.js >= v22.6 with [--experimental-strip-types](https://nodejs.org/api/cli.html#--experimental-strip-types)
1. Node.js >= v22.7 with [--experimental-transform-types](https://nodejs.org/api/cli.html#--experimental-transform-types)

you can use the built-in TS transformation of Node.js.

```json title="package.json"
{
  "build": "NODE_OPTIONS=--experimental-transform-types rspeedy build"
}
```

See [Node.js - TypeScript](https://nodejs.org/api/typescript.html) for more details.

## rspeedy -h

To view all available CLI commands, run the following command in the project directory:

```bash
rspeedy -h
```

The output is shown below:

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

The `rspeedy dev` command is used to start a local dev server and compile the source code for development.

```text
➜ rspeedy dev --help

Usage: rspeedy dev [options]

Options:
  -b --base <base>          specify the base path of the server
  -c --config <config>      specify the configuration file, can be a relative or absolute path
  --env-mode <mode>         specify the env mode to load the .env.[mode] file
  --environment <name...>   specify the name of environment to build
  --no-env                  disable loading `.env` files"
  -h, --help                display help for command
```

The dev server will restart automatically when the content of the configuration file is modified.

## rspeedy build

The `rspeedy build` command will build the outputs for production in the `dist/` directory by default.

```text
➜ rspeedy build --help

Usage: rspeedy build [options]

Options:
  -c --config <config>      specify the configuration file, can be a relative or absolute path
  --env-mode <mode>         specify the env mode to load the .env.[mode] file
  --environment <name...>   specify the name of environment to build
  --no-env                  disable loading `.env` files"
  -h, --help                display help for command
```

## rspeedy preview

The `rspeedy preview` command is used to preview the production build outputs locally. Note that you need to execute the `rspeedy build` command beforehand to generate the build outputs.

```text
➜ rspeedy preview --help

Usage: rspeedy preview [options]

Options:
  -b --base <base>      specify the base path of the server
  -c --config <config>  specify the configuration file, can be a relative or absolute path
  --env-mode <mode>     specify the env mode to load the .env.[mode] file
  --no-env              disable loading `.env` files"
  -h, --help            display help for command
```

:::tip
The preview command is only used for local preview. Do not use it for production servers, as it is not designed for that.
:::

## rspeedy inspect

The `rspeedy inspect` command is used to view the Rspeedy config and Rspack config of the project.

```text
➜ rspeedy inspect --help

Usage: rspeedy inspect [options]

View the Rsbuild config and Rspack config of the project.

Options:
  --mode <mode>         specify the mode of Rsbuild (default: "development")
  --output <output>     specify inspect content output path
  --verbose             show full function definitions in output
  -c --config <config>  specify the configuration file, can be a relative or absolute path
  --env-mode <mode>     specify the env mode to load the .env.[mode] file
  --no-env              disable loading `.env` files"
  -h, --help            display help for command
```

When you run the command `rspeedy inspect` in the project root directory, the following files will be generated in the `dist/.rspeedy` directory of the project:

- `rspeedy.config.js`: Represents the Rspeedy configuration used during the build.
- `rsbuild.config.mjs`: Represents the Rsbuild configuration used during the build.
- `rspack.config.lynx.mjs`: Represents the Rspack configuration used during the build.

```text
➜ rspeedy inspect

Inspect config succeed, open following files to view the content:

  - Rspeedy Config: /project/dist/.rsbuild/rspeedy.config.mjs
  - Rspack Config (lynx): /project/dist/.rsbuild/rspack.config.lynx.mjs

Inspect Rspeedy config succeed, open following files to view the content:

  - Rspeedy: /Users/colin/rspeedy/examples/react/dist/rspeedy-rspack/.rsbuild/rspeedy.config.js
```

### Specifying Mode

By default, the inspect command outputs the configuration for the development mode. You can add the `--env production` option to output the configuration for the production mode:

```bash
rspeedy inspect --mode production
```

### Verbose content

By default, the inspect command omits the content of functions in the configuration object. You can add the `--verbose` option to output the complete content of functions:

```bash
rspeedy inspect --verbose
```
