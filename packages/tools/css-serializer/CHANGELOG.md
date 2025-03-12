# @lynx-js/css-serializer

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
