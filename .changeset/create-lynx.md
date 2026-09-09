---
"@lynx-js/create-lynx": minor
"create-rspeedy": patch
---

Add `@lynx-js/create-lynx`, which scaffolds a Lynx app or library for any of the build tools:

```bash
npm create @lynx-js/lynx@latest
```

`rsbuild-ts` / `rsbuild-js` build an app with Rsbuild and `pluginLynx`, `rspeedy-ts` / `rspeedy-js` build one with Rspeedy, and `rslib-ts` / `rslib-js` build a ReactLynx component library with Rslib that keeps JSX in its output. Every template comes with Rstest and `@lynx-js/react/testing-library` set up. It supersedes `create-rspeedy`, which now carries a deprecation notice and no longer receives updates.
