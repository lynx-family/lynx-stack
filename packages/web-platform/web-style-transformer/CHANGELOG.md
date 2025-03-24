# @lynx-js/web-style-transformer

## 0.2.3

### Patch Changes

- feat: 1. list adds support for the `sticky` attribute. Now sticky-offset, sticky-top, and sticky-bottom will only take effect when `sticky` is `true`. ([#257](https://github.com/lynx-family/lynx-stack/pull/257))

  2. Added support for `list-main-axis-gap`, `list-cross-axis-gap`.

## 0.2.2

### Patch Changes

- Support NPM provenance. ([#30](https://github.com/lynx-family/lynx-stack/pull/30))

- feat: support `justify-content`, `align-self` in linear container ([#37](https://github.com/lynx-family/lynx-stack/pull/37))

  Now these two properties could work in a linear container.

  We don't transforms the `justify-content` and `align-self` to css vars any more.

  The previous version of `@lynx-js/web-core` won't work with current `@lynx-js/web-core` after this change.

## 0.2.1

### Patch Changes

- 2738fdc: feat: support linear-direction

## 0.2.0

### Minor Changes

- e406d69: refractor: update output json format

  **This is a breaking change**

  Before this change the style info is dump in Javascript code.

  After this change the style info will be pure JSON data.

  Now we're using the css-serializer tool's output only. If you're using plugins for it, now they're enabled.

## 0.1.0

### Minor Changes

- 39cf3ae: feat: improve performance for supporting linear layout

  Before this commit, we'll use `getComputedStyle()` to find out if a dom is a linear container.

  After this commit, we'll use the css variable cyclic toggle pattern and `@container style()`

  This feature requires **Chrome 111, Safari 18**.

  We'll provide a fallback implementation for firefox and legacy browsers.

  After this commit, your `flex-direction`, `flex-shrink`, `flex`, `flex-grow`, `flex-basis` will be transformed to a css variable expression.

- 6e003e8: feat(web): support linear layout and add tests

### Patch Changes

- f28650f: fix: `flex:1` transforming issue
