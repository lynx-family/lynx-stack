# @lynx-js/create-lynx

## 0.2.0

### Minor Changes

- Add `@lynx-js/create-lynx`, which scaffolds a Lynx app or library for any of the build tools: ([#3864](https://github.com/lynx-family/lynx-stack/pull/3864))

  ```bash
  npm create @lynx-js/lynx@latest
  ```

  `rsbuild-ts` / `rsbuild-js` build an app with Rsbuild and `pluginLynx`, `rspeedy-ts` / `rspeedy-js` build one with Rspeedy, and `rslib-ts` / `rslib-js` build a ReactLynx component library with Rslib that keeps JSX in its output; the `external-bundle` tool also packs that library into a Lynx External Bundle. Every template comes with Rstest and `@lynx-js/react/testing-library` set up. It supersedes `create-rspeedy`, which now carries a deprecation notice and no longer receives updates.
- `create-rspeedy` now delegates to `@lynx-js/create-lynx`, pinned to Rspeedy. It keeps its own templates no longer, so the two stay in step by construction. `@lynx-js/create-lynx` exports `createLynx()` for that. ([#3871](https://github.com/lynx-family/lynx-stack/pull/3871))
