# @lynx-js/web-elements-compat

## 0.2.3

### Patch Changes

- Support NPM provenance. ([#30](https://github.com/lynx-family/lynx-stack/pull/30))

- feat: support `justify-content`, `align-self` in linear container ([#37](https://github.com/lynx-family/lynx-stack/pull/37))

  Now these two properties could work in a linear container.

  We don't transforms the `justify-content` and `align-self` to css vars any more.

  The previous version of `@lynx-js/web-core` won't work with current `@lynx-js/web-core` after this change.

## 0.2.2

### Patch Changes

- Updated dependencies [5649861]
- Updated dependencies [65ac6a2]
- Updated dependencies [875cfd3]
  - @lynx-js/web-elements@0.1.6

## 0.2.1

### Patch Changes

- Updated dependencies [b2fd603]
- Updated dependencies [3ebcb99]
- Updated dependencies [c19bba8]
  - @lynx-js/web-elements@0.1.5

## 0.2.0

### Minor Changes

- f190212: fix: compat logic for flex container's children

  ```css
  [lynx-computed-display="flex"] {
    flex-direction: var(--flex-direction);
    justify-content: var(--justify-content);
    flex-wrap: var(--flex-wrap);
  }
  ```

  These styles should be applied on the flex container itself.

### Patch Changes

- addc058: fix: incorrect linear detect after chrome 130

  see https://chromestatus.com/feature/5242724333387776

- Updated dependencies [5c3f447]
- Updated dependencies [addc058]
- Updated dependencies [90131cc]
- Updated dependencies [75877ed]
  - @lynx-js/web-elements@0.1.4

## 0.1.3

### Patch Changes

- f650509: fix: browser compatibility issues

  1. safari 17.2~18.0 issue

  `display:linear` doesn't work

  2. chrome < 99 issue

  text may be blank on these browsers

- Updated dependencies [9b99484]
- Updated dependencies [f650509]
  - @lynx-js/web-elements@0.1.3

## 0.1.2

### Patch Changes

- d93e3e6: fix: add default value of --justify-content, --flex-wrap, --align-self
- Updated dependencies [6a97751]
- Updated dependencies [55f73a2]
  - @lynx-js/web-elements@0.1.2

## 0.1.1

### Patch Changes

- d22fbbc: fix(web):

  1. minimum supported version updates to 117 due to the crash of @container.
  2. add text color compatibility in less than 99 version chrome.
  3. add lynx-computed-style of flex css property.

- Updated dependencies [ddc8c5a]
  - @lynx-js/web-elements@0.1.1

## 0.1.0

### Minor Changes

- 2e0a780: feat: move LinearContainer to web-elements-compat

  In this commit, we're going to remove all LinearContainer Class from custom elements.

  It now relies on the `@container style(){}`, which is supported by chrome 111 and safari 18.

  For compating usage, `@lynx-js/web-elements-compat/LinearContainer` is provided.

  ```javascript
  import '@lynx-js/web-elements-compat/LinearContainer';
  import '@lynx-js/web-elements/all';
  ```

### Patch Changes

- 7ee0dc1: fix(web): rename swiper-item to x-swiper-item
- eba8f72: fix: add --flex-grow, --flex-shrink, --flex-basis default value
- f9c751a: fix: minor improvment for all web elements
- 0deda8f: fix(web): add --flex-direction default value
- e170052: chore: remove tslib

  We provide ESNext output for this lib.

- Updated dependencies [987da15]
- Updated dependencies [3e66349]
- Updated dependencies [2b7a4fe]
- Updated dependencies [461d965]
- Updated dependencies [7ee0dc1]
- Updated dependencies [7c752d9]
- Updated dependencies [29e4684]
- Updated dependencies [3547621]
- Updated dependencies [bed4f24]
- Updated dependencies [33691cd]
- Updated dependencies [2047658]
- Updated dependencies [b323923]
- Updated dependencies [39cf3ae]
- Updated dependencies [917e496]
- Updated dependencies [532380d]
- Updated dependencies [a41965d]
- Updated dependencies [2e0a780]
- Updated dependencies [a7a222b]
- Updated dependencies [f8d1d98]
- Updated dependencies [81be6cf]
- Updated dependencies [f8d1d98]
- Updated dependencies [5018d8f]
- Updated dependencies [c0a482a]
- Updated dependencies [314cb44]
- Updated dependencies [8c6eeb9]
- Updated dependencies [e0854a8]
- Updated dependencies [e86bba0]
- Updated dependencies [1fe49a2]
- Updated dependencies [f0a50b6]
  - @lynx-js/web-elements@0.1.0
