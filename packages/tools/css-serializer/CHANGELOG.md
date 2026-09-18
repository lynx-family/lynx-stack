# @lynx-js/css-serializer

## 0.1.9

### Patch Changes

- Point `@lynx-js/source-field` at `src/index.ts`, so a bundler in this repo can ([#3404](https://github.com/lynx-family/lynx-stack/pull/3404))
  resolve the package without waiting for its `dist/`.

  `@lynx-js/css-serializer` has no `build` script - its `dist/` is emitted by the
  repository's root `tsc --build`, which is a separate turbo task with no ordering
  relationship to any package's `build`. That was invisible while every consumer
  was itself type-checked rather than bundled, but `@lynx-js/web-core` bundles its
  client with rspack, and rspack resolving `main: dist/index.js` before the root
  build has emitted it fails outright.

  `@rsbuild/plugin-source-build` is already how this repository answers that -
  `@lynx-js/web-elements` and `@lynx-js/web-worker-rpc` declare the same field and
  are consumed straight from source. Declaring it here removes the ordering
  question rather than scheduling around it.

  The field is inert outside such a build: it is a plain, unknown top-level
  `package.json` key, so no `exports` map is introduced and no existing entry point
  or deep import changes.

## 0.1.8

### Patch Changes

- Replace `node:path` with `pathe` in `generateHref` so the package can be bundled for browsers. ([#3401](https://github.com/lynx-family/lynx-stack/pull/3401))

  Hrefs resolved from a `projectRoot` or `filename` containing a backslash change, because `pathe` normalizes Windows separators on every platform. Pure POSIX inputs, including the defaults, are unaffected.

## 0.1.7

### Patch Changes

- Update `css-tree` from `^3.1.0` to `^3.2.1` ([#3118](https://github.com/lynx-family/lynx-stack/pull/3118))

## 0.1.6

### Patch Changes

- Add CSS source map support and source-mapped template encode diagnostics. ([#2483](https://github.com/lynx-family/lynx-stack/pull/2483))

## 0.1.5

### Patch Changes

- feat: add support for @media, @supports, and @layer at-rules ([#2330](https://github.com/lynx-family/lynx-stack/pull/2330))

  Add support for additional CSS at-rules in the CSS serializer:

  - `@media` - for media queries
  - `@supports` - for feature queries
  - `@layer` - for cascade layers (both named and anonymous)

  The parser now handles these at-rules with proper recursive parsing support for nested at-rules.

- feat: support custom property declaration in keyframe rule ([#2429](https://github.com/lynx-family/lynx-stack/pull/2429))

## 0.1.4

### Patch Changes

- Move `cssChunksToMap` implementation from `@lynx-js/template-webpack-plugin` to `@lynx-js/css-serializer` for future reuse. ([#2269](https://github.com/lynx-family/lynx-stack/pull/2269))

## 0.1.3

### Patch Changes

- Support Windows. ([#1007](https://github.com/lynx-family/lynx-stack/pull/1007))

## 0.1.2

### Patch Changes

- Support NPM provenance. ([#30](https://github.com/lynx-family/lynx-stack/pull/30))

## 0.1.1

### Patch Changes

- 1f791a3: Fix invalid style when using CSS variables with shorthand properties.

  E.g.:

  ```css
  .foo {
    border-bottom: 6px var(--bg) solid;
  }
  ```

  ```diff
  - "value": "6px {{--primary-color}}solid"
  + "value": "6px {{--primary-color}} solid"
  ```

## 0.1.0

### Minor Changes

- 6c31ddd: fix: avoid export name collision

### Patch Changes

- 36e5ddb:
- 6d05c70: Support nested CSS variables
