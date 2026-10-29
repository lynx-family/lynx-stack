# @lynx-js/lynx-stack-docs

The API reference site of Lynx Stack, built with [Rspress](https://rspress.rs). Every page under `content/*/api` is generated from the TSDoc of the public packages by [TypeDoc](https://typedoc.org) and [typedoc-plugin-markdown](https://typedoc-plugin-markdown.org), when the site builds. The generated pages are not committed.

```sh
# Build the packages and generate or restore the publishable API pages.
pnpm turbo build --filter @lynx-js/lynx-stack-docs
# Force a fresh static site in doc_build.
pnpm turbo build --filter @lynx-js/lynx-stack-docs --force
# Start the development server at http://localhost:3000.
pnpm turbo dev --filter @lynx-js/lynx-stack-docs
```

The static `doc_build` directory is intentionally excluded from Turbo's
cached outputs because it is large and is not published. On a cache hit,
Turbo restores the generated API pages, manifest and translations, but not
`doc_build`. Use the forced build above when you need fresh static output.

## How the pages are produced

`plugins/` registers `@rspress/plugin-typedoc` once per section and locale:

| Section                     | Packages                                                 |
| --------------------------- | -------------------------------------------------------- |
| `api/react`                 | `@lynx-js/react`, grouped by `@group`                    |
| `api/react/testing-library` | `@lynx-js/react/testing-library`                         |
| `api/genui`                 | the entry points listed in `packages/genui/typedoc.json` |
| `api/packages`              | shown and additional packages without their own section  |
| `api/build`                 | the Rspeedy `Config` and the `pluginLynx` options        |

Standalone package pages are generated for `shown-packages.json` entries and `Site.additionalPackages`. Only the shown list is published as the manifest's plugin menu. Additional packages retain pages for a consumer's separate navigation, such as `@lynx-js/testing-environment` in lynxjs.org's Testing group, without duplicating its menu entry. References to known hidden packages are rendered as text instead of links. When an explicit source annotation references a hidden import and resolves to `any`, its source spelling is retained. Unavailable inherited members and inferred types cannot be reconstructed. React, testing-library, GenUI and configuration sections retain their dedicated pages.

Each package is converted with TypeDoc's `packages` strategy, from `src/index.ts` unless its own `typedoc.json` says otherwise. A package without an API gets a page with its links and `package.json` description. The build fails on any TypeDoc warning.

Documented workspace packages must be listed in this package's `devDependencies`; Turbo's `^build` builds their dependencies before conversion. Run `pnpm --filter @lynx-js/lynx-stack-docs check:dependencies` after adding a package or section. CI runs this check even when the documentation build is cached, using the same section selection as the generator. Packages with separate production and test projects should set `tsconfig` in their `typedoc.json` to the production configuration. TypeScript diagnostics remain enabled. TypeDoc warnings, including invalid links to shown or unknown packages, still fail the build. This does not remove Turbo dependency builds.

The content comes from TSDoc only: a package introduction is its `@packageDocumentation`, ReactLynx guides such as the directives are `@document` pages under `packages/react/docs`, and a configuration option is tagged `@lynxDefaultChanged` when `pluginLynx` changes its Rsbuild default. When a page is wrong, change the TSDoc.

## Chinese

The Chinese pages are rendered again with TypeDoc's `lang: 'zh'`. Their prose is translated through `i18n/zh.json`, which maps each English paragraph or table cell to its Chinese text. A build adds new English strings with an empty value. Existing nonempty translations are retained even when a build does not render them. Commit `i18n/zh.json`; CI fails while a value is empty or the file is out of date.

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

A consuming site can set `Site.translations` to an array of dictionary file
paths, ordered from lowest to highest precedence. The generator writes only
the last file, saving additions and overrides while removing translations
identical to a nonempty value from the preceding files. Missing translations
are collected in that last file and still fail production builds. When omitted,
the generator uses `[join(site.docs, 'i18n/zh.json')]`.
