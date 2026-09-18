# @lynx-js/lynx-stack-docs

The API reference of [Lynx Stack](https://github.com/lynx-family/lynx-stack) as MDX pages, for documentation sites that show it next to their own pages. It covers the build configuration (`rsbuild.config.ts` with `pluginLynx`, or `lynx.config.ts`), ReactLynx, GenUI and every public package of Lynx Stack, in English and Chinese.

The pages are generated from the TSDoc comments of the packages. Each version of this package is published with the Lynx Stack release it describes.

## Layout

```
content/
  en/api/
    config/      build configuration
    react/       @lynx-js/react
    genui/       @lynx-js/genui
    packages/    every other package
  zh/            the same pages in Chinese
manifest.json
```

Each directory carries its Rspress `_meta.json`. Copy `content/<locale>/api` to the same path under your docs root. Links between the pages are absolute (`/api/config/output/filename-bundle`) or relative to the page, so keep the layout.

Every package has a page, so links stay valid. `manifest.json` names the sections, where their pages are, and the packages to show in navigation, in order and by group.
