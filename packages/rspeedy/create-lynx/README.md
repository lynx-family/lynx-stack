# @lynx-js/create-lynx

Create a [Lynx](https://lynxjs.org/) app with one command.

```bash
npm create @lynx-js/lynx@latest
```

## Templates

Templates are named `<build tool>-<DSL>-<language>`. Parts that are left out
take their default, so `rsbuild`, `rsbuild-ts` and `rsbuild-react-ts` all name
the same template.

| Template                                | Build tool                                       | Config             |
| --------------------------------------- | ------------------------------------------------ | ------------------ |
| `rsbuild-react-ts` / `rsbuild-react-js` | [Rsbuild](https://rsbuild.rs/) with `pluginLynx` | `rsbuild.config.*` |
| `rspeedy-react-ts` / `rspeedy-react-js` | [Rspeedy](https://lynxjs.org/rspeedy/)           | `lynx.config.*`    |

```bash
npm create @lynx-js/lynx@latest my-app -- --template rsbuild-react-ts
```

## Options

| Option           | Description                                                                      |
| ---------------- | -------------------------------------------------------------------------------- |
| `-d, --dir`      | Directory to create the project in                                               |
| `-t, --template` | Template to use                                                                  |
| `--tools`        | Extra tools, such as `vitest-rltl`, `rstest-rltl`, `eslint`, `prettier`, `biome` |
| `--skill`        | Agent skills to install                                                          |
| `--override`     | Override files in the target directory                                           |

This package supersedes `create-rspeedy`.
