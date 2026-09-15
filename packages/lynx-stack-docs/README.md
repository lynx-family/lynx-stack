# @lynx-js/lynx-stack-docs

The API reference of [Lynx Stack](https://github.com/lynx-family/lynx-stack) as MDX pages, for documentation sites that show it next to their own pages. It covers the build configuration (`rsbuild.config.ts` with `pluginLynx`, or `lynx.config.ts`), the Rsbuild plugins, ReactLynx and every public `@lynx-js` package, in English and Chinese.

The pages are generated from the TSDoc comments of the packages. Each version of this package is published with the Lynx Stack release it describes.

## Layout

```
content/
  en/api/
    config/      build configuration
    react/       ReactLynx API
    packages/    every @lynx-js package, the Rsbuild plugins included
  zh/            the same pages in Chinese
```

Each directory carries its Rspress `_meta.json`. Copy a directory to the same path under your docs root, for example `content/en/api/config` to `docs/en/api/config`.

## What the pages expect

- Rspress 2. The only MDX import is `PackageManagerTabs` from `@rspress/core/theme`.
- Links between the pages are absolute (`/api/config/output/filename-bundle`), so keep the layout above. Links to other Lynx pages point to `https://lynxjs.org`.
- A few elements use class names for the theme to style: `api-badge`, `api-badge-*`, `api-pkg-header`, `api-config-overview`, `api-config-group`, `api-packages-overview` and `api-package-main`. `docs/src/styles/_api.scss` in lynx-stack has the styles.
