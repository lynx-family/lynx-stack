# @lynx-js/css-serializer

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
