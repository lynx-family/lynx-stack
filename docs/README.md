# docs

The API reference site for lynx-stack, built with Rspress. It covers the Lynx build configuration, the Rsbuild plugins, `@lynx-js/react` and every other public `@lynx-js` package. It holds API reference only; guides live on [lynxjs.org](https://lynxjs.org).

```sh
pnpm --filter docs dev        # http://localhost:3000
pnpm --filter docs build      # doc_build/
pnpm --filter docs generate   # regenerate api-data/ and the generated regions in en/**.mdx
```

## How the pages are produced

Every page is a handwritten MDX file under `content/en/`; `content/` is the Rspress root, so the package files next to it (`scripts/`, `api-data/`, `node_modules/`) are never scanned or watched. The parts that come from the source code live between two markers and are rewritten by `pnpm generate`:

```mdx
## Options

{/* @api ApiOptions package="rsbuild-plugin" type="LynxPluginOptions" */}
...generated markdown, do not edit...
{/* @api-end */}
```

`generate` runs in two steps:

1. `scripts/generate-api-data.ts` runs typedoc over each package listed in `scripts/packages.ts` and writes one JSON per package to `api-data/`. Types, defaults, `@remarks`, `@example` and `@deprecated` come from the TSDoc in the package sources. Source positions are not recorded so that a change elsewhere in a file does not churn the JSON.
2. `scripts/expand-api-docs.ts` walks `content/en/**/*.mdx`, finds the markers and renders the matching JSON into markdown. Because the generated text is plain markdown inside the page, Rspress builds the outline, the anchors and the search index from it like any other content.

Directives:

| Directive                                                      | Renders                                                 |
| -------------------------------------------------------------- | ------------------------------------------------------- |
| `PackageHeader package="id"`                                   | package name, version, npm / source / changelog links   |
| `ApiOptions package="id" type="Interface"`                     | an options interface as nested sections, one per option |
| `ConfigOptions package="rspeedy" type="Config" path="output"`  | one namespace of `lynx.config.ts`                       |
| `ConfigOverview package="rspeedy" type="Config" path="output"` | the summary table of a namespace                        |
| `ApiExports package="id" include="a,b" exclude="c"`            | functions, classes, constants and types of a package    |

`package` is the `id` from `scripts/packages.ts`. Anchors are the option path in kebab case (`output.filename.bundle` → `#output-filename-bundle`), so links to an option are stable across regenerations.

## Chinese

Handwritten pages have a Chinese copy under `content/zh/` with the same path; edit both when you change one.

Generated text is translated through sidecar files, one per package: `api-data/zh/<package>.json` maps each string (`Output.filename.summary`, `Output.filename.example.0`, …) to its translation and a hash of the English it was translated from. `expand-api-docs.ts` uses the translation only while the hash still matches; when the English changes, the page falls back to the English text and shows a 待翻译 badge until someone updates the translation. A stale translation is never shown silently.

```sh
pnpm --filter docs i18n:extract          # add new/changed strings to api-data/zh/*.json
pnpm --filter docs i18n:dump <dir> <package>   # write the untranslated prose segments to <dir>/seg-<package>.tsv
pnpm --filter docs i18n:apply <dir>             # read <dir>/seg-*.zh.tsv back into the sidecars
pnpm --filter docs generate              # re-render the pages
```

Code blocks are never sent for translation; only the prose around them is.

## Configuration pages

The pages under `content/*/config` apply to both `rsbuild.config.ts` with `pluginLynx` and `lynx.config.ts`. `pnpm generate` writes `api-data/rsbuild-config.json`, the option paths of `RsbuildConfig` read from the installed `@rsbuild/core` types. The overview (`config/index.mdx`) groups every option the way the Rsbuild config overview does: options that Rsbuild also has link to the Rsbuild documentation, and options whose Lynx default differs get a short page that shows both defaults and links to the Rsbuild documentation. Each option that is specific to Lynx gets its own page under `config/<namespace>/`, created by `pnpm generate` (`scripts/config-pages.ts`) with how to set it through `pluginLynx` or `lynx.config.ts`; text added outside the generated region is kept.

## Adding a package

Add an entry to `scripts/packages.ts` with the package directory and its type entry point (a `src/index.ts` or a `.d.ts`), run `pnpm generate`, then create the page under `content/en/packages/` with the directives above. `scripts/scaffold-pages.ts` creates a starting page for any package that does not have one yet; it never overwrites an existing file. The entry's `group` and its position in the list decide where the package appears in the packages overview (`packages/index.mdx`) and sidebar, which `pnpm generate` writes; put the packages most apps use first.

## Keeping the generated regions current

CI runs `pnpm --filter docs check`, which regenerates everything and fails if `api-data/` or any generated region differs from what is committed. When a TSDoc comment changes, run `pnpm generate` and commit the result in the same PR.

## Sync to lynxjs.org

`content/en/config`, `content/en/react/api` and `content/en/packages` mirror the layout of `lynx-website/docs/en/`. They are copied there as-is; the generated content is already inside the files, so lynx-website needs no extra tooling. Links inside these pages are absolute (`/config/output/filename-bundle`) and resolve on both sites.

The same directories are published as `@lynx-js/lynx-stack-docs` (`packages/lynx-stack-docs`), which copies them at build time. It is released with every Lynx Stack release: `.github/scripts/add-docs-changeset.cjs` adds its changeset when a release publishes other packages.
