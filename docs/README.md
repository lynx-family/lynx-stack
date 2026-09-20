# @lynx-js/lynx-stack-docs

The API reference site of Lynx Stack, built with [Rspress](https://rspress.rs). Every page under `content/*/api` is generated from the TSDoc of the public packages by [TypeDoc](https://typedoc.org) and [typedoc-plugin-markdown](https://typedoc-plugin-markdown.org), when the site builds. The generated pages are not committed.

```sh
pnpm turbo build --filter @lynx-js/lynx-stack-docs    # build the packages, generate the pages and build the site
pnpm turbo dev --filter @lynx-js/lynx-stack-docs      # http://localhost:3000
```

## How the pages are produced

`plugins/` registers `@rspress/plugin-typedoc` once per section and locale:

| Section                     | Packages                                                 |
| --------------------------- | -------------------------------------------------------- |
| `api/react`                 | `@lynx-js/react`, grouped by `@group`                    |
| `api/react/testing-library` | `@lynx-js/react/testing-library`                         |
| `api/genui`                 | the entry points listed in `packages/genui/typedoc.json` |
| `api/packages`              | every other public package of the workspace              |
| `api/build`                 | the Rspeedy `Config` and the `pluginLynx` options        |

Each package is converted with TypeDoc's `packages` strategy, from `src/index.ts` unless its own `typedoc.json` says otherwise. A package without an API gets a page with its links and `package.json` description. The build fails on any TypeDoc warning.

The content comes from TSDoc only: a package introduction is its `@packageDocumentation`, ReactLynx guides such as the directives are `@document` pages under `packages/react/docs`, and a configuration option is tagged `@lynxDefaultChanged` when `pluginLynx` changes its Rsbuild default. When a page is wrong, change the TSDoc.

## Chinese

The Chinese pages are rendered again with TypeDoc's `lang: 'zh'`. Their prose is translated through `i18n/zh.json`, which maps each English paragraph or table cell to its Chinese text. A build adds new English strings with an empty value and drops strings that no longer appear. Commit `i18n/zh.json`; CI fails while a value is empty or the file is out of date.

## Sync to lynxjs.org

This directory is also the `@lynx-js/lynx-stack-docs` package: it publishes `content/*/api` and `manifest.json` with every Lynx Stack release, and nothing else. `manifest.json` names the sections, where their pages are, and the packages to show in navigation, in order and by group; lynx-website reads it and copies the pages. Copy `content/<locale>/api` to the same path under your docs root: each directory carries its Rspress `_meta.json`, and the links between the pages assume that layout.

## Another repository

A repository that vendors this one generates its own reference with these plugins instead of copying them. Its Rspress config passes its own site:

```
import { pluginApiReference } from '../lynx-stack/docs/plugins/index.ts';
import { IN_HOUSE } from './site.ts';

export default defineConfig({ plugins: pluginApiReference(IN_HOUSE) });
```

`Site` in `plugins/site.ts` holds everything that belongs to a repository rather than to the reference: the directory the pages are written to and the workspace they are read from, where its source and its published packages are browsed, the packages with a section of their own, how the rest are grouped, the navigation, and — when it has one — where its configuration reference comes from. `packages` narrows what the workspace publishes to what to document, and `wrappers` names a module after the package that re-exports it, for a workspace that vendors another one and publishes thin packages over it.

The plugins resolve TypeDoc and Rspress from this directory, so the workspace of the other repository has to include it.
