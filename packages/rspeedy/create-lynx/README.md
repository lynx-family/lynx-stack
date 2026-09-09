# @lynx-js/create-lynx

Create a [Lynx](https://lynxjs.org/) app or library with one command.

```bash
npm create @lynx-js/lynx@latest
```

## Templates

Templates are named `<build tool>-<DSL>-<language>`. Parts that are left out
take their default, so `rsbuild`, `rsbuild-ts` and `rsbuild-react-ts` all name
the same template.

| Template                                | Creates | Build tool                                       | Config             |
| --------------------------------------- | ------- | ------------------------------------------------ | ------------------ |
| `rsbuild-react-ts` / `rsbuild-react-js` | App     | [Rsbuild](https://rsbuild.rs/) with `pluginLynx` | `rsbuild.config.*` |
| `rspeedy-react-ts` / `rspeedy-react-js` | App     | [Rspeedy](https://lynxjs.org/rspeedy/)           | `lynx.config.*`    |
| `rslib-react-ts` / `rslib-react-js`     | Library | [Rslib](https://rslib.rs/)                       | `rslib.config.*`   |

Every template comes with [Rstest](https://rstest.rs/) and
`@lynx-js/react/testing-library` set up; run the tests with `npm run test`.

A library keeps JSX in its output (`dist/*.jsx`), so the Lynx app that depends
on it compiles the components with its own ReactLynx version.

```bash
npm create @lynx-js/lynx@latest my-app -- --template rsbuild-react-ts
npm create @lynx-js/lynx@latest my-lib -- --template rslib-react-ts
```

## Options

| Option           | Description                                        |
| ---------------- | -------------------------------------------------- |
| `-d, --dir`      | Directory to create the project in                 |
| `-t, --template` | Template to use                                    |
| `--tools`        | Extra tools, such as `eslint`, `prettier`, `biome` |
| `--skill`        | Agent skills to install                            |
| `--override`     | Override files in the target directory             |

This package supersedes `create-rspeedy`.
