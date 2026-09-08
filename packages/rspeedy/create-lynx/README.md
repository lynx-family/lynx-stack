# @lynx-js/create-lynx

Create a [Lynx](https://lynxjs.org/) app with one command.

```bash
npm create @lynx-js/lynx@latest
```

## Templates

Pick a build tool and a language, or pass `--template <tool>-<lang>`:

| Template                    | Build tool                                       | Config             |
| --------------------------- | ------------------------------------------------ | ------------------ |
| `rsbuild-ts` / `rsbuild-js` | [Rsbuild](https://rsbuild.rs/) with `pluginLynx` | `rsbuild.config.*` |
| `rspeedy-ts` / `rspeedy-js` | [Rspeedy](https://lynxjs.org/rspeedy/)           | `lynx.config.*`    |

```bash
npm create @lynx-js/lynx@latest my-app -- --template rsbuild-ts
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
