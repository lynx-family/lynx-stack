# @lynx-js/tailwind-preset

## 0.1.0

### Minor Changes

- feat: rewrite the main thread Element PAPIs ([#343](https://github.com/lynx-family/lynx-stack/pull/343))

  In this commit we've rewritten the main thread apis.

  The most highlighted change is that

  - Before this commit we send events directly to bts
  - After this change, we send events to mts then send them to bts with some data combined.

## 0.0.2

### Patch Changes

- Support NPM provenance. ([#30](https://github.com/lynx-family/lynx-stack/pull/30))

## 0.0.1

### Patch Changes

- c5e3416: New Package `@lynx-js/tailwind-preset` to include lynx-only tailwindcss features
