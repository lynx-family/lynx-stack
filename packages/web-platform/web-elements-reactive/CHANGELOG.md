# @lynx-js/web-elements-reactive

## 0.1.1

### Patch Changes

- Support NPM provenance. ([#30](https://github.com/lynx-family/lynx-stack/pull/30))

## 0.1.0

### Minor Changes

- 2e0a780: feat: support registerPlugin for web-elements

  After this commit, we allow developers to add ReactiveAttribute Classes to a web custom element

  ```javascript
  class MyReactiveAttributeClass{

  }

  (customElements.get(tag) as WebComponentClass).registerPlugin?.(
        MyReactiveAttributeClass,
  );
  ```

### Patch Changes

- a1d0070: chore: tolerance babel bug for super.property?.

  close #82

- e170052: chore: remove tslib

  We provide ESNext output for this lib.

- e86bba0: fix(web): do not remove `"false"` value for dataset attributes

  fix #77
