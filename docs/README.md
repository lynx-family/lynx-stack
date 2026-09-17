# docs

The API reference site of Lynx Stack, built with [Rspress](https://rspress.rs). Every page under `content/*/api` is generated from the TSDoc of the public packages by [TypeDoc](https://typedoc.org) and [typedoc-plugin-markdown](https://typedoc-plugin-markdown.org), when the site builds. The generated pages are not committed.

```sh
pnpm turbo build --filter docs    # build the packages, generate the pages and build the site
pnpm turbo dev --filter docs      # http://localhost:3000
pnpm --filter docs i18n:check     # fail while a Chinese string is missing
```

## How the pages are produced

`plugins/` registers `@rspress/plugin-typedoc` once per section and locale:

| Section                     | Packages                                                 |
| --------------------------- | -------------------------------------------------------- |
| `api/react`                 | `@lynx-js/react`, grouped by `@group`                    |
| `api/react/testing-library` | `@lynx-js/react/testing-library`                         |
| `api/genui`                 | the entry points listed in `packages/genui/typedoc.json` |
| `api/packages`              | every other public package of the workspace              |
| `api/config`                | the Rspeedy `Config` and the `pluginLynx` options        |

Each package is converted with TypeDoc's `packages` strategy, from `src/index.ts` unless its own `typedoc.json` says otherwise. A package without an API gets a page with its links and `package.json` description. The build fails on any TypeDoc warning.

The content comes from TSDoc only: a package introduction is its `@packageDocumentation`, ReactLynx guides such as the directives are `@document` pages under `packages/react/docs`, and a configuration option is tagged `@lynxDefaultChanged` when `pluginLynx` changes its Rsbuild default. When a page is wrong, change the TSDoc.

## Chinese

The Chinese pages are rendered again with TypeDoc's `lang: 'zh'`. Their prose is translated through `i18n/zh.json`, which maps each English paragraph or table cell to its Chinese text. A build adds new English strings with an empty value and drops strings that no longer appear. Commit `i18n/zh.json`; CI fails while a value is empty or the file is out of date.

## Sync to lynxjs.org

`@lynx-js/lynx-stack-docs` (`packages/lynx-stack-docs`) publishes `content/*/api` and `shown-packages.json` with every Lynx Stack release. lynx-website copies the pages and lists only the packages in `shown-packages.json` in its navigation.
