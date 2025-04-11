# @lynx-js/web-elements

## 0.5.4

### Patch Changes

- chore: bump the output target to es2024 ([#518](https://github.com/lynx-family/lynx-stack/pull/518))

- fix: the `\n` character should create a new line ([#522](https://github.com/lynx-family/lynx-stack/pull/522))

  add `white-space-collapse: preserve-breaks` to raw-text

- fix: the `input` event of x-input with number type should have raw value ([#517](https://github.com/lynx-family/lynx-stack/pull/517))

  For `type:=number` x-input with typed value "2."

  Before this commit: the value is "2"

  After this commit the value is "2."

## 0.5.3

### Patch Changes

- feat: add `layoutchange` event support for x-view and x-text ([#408](https://github.com/lynx-family/lynx-stack/pull/408))

## 0.5.2

### Patch Changes

- fix: When list with list-type: flow, scrolltoupper, scrolltolower were specified, there was a blank block. ([#379](https://github.com/lynx-family/lynx-stack/pull/379))

- fix: do not show scroll bar ([#406](https://github.com/lynx-family/lynx-stack/pull/406))

## 0.5.1

### Patch Changes

- Updated dependencies [[`082ad97`](https://github.com/lynx-family/lynx-stack/commit/082ad97510c212aa00a9395044bb6fc39a82940a)]:
  - @lynx-js/web-elements-reactive@0.2.1

## 0.5.0

### Minor Changes

- feat: 1. list adds support for the `sticky` attribute. Now sticky-offset, sticky-top, and sticky-bottom will only take effect when `sticky` is `true`. ([#257](https://github.com/lynx-family/lynx-stack/pull/257))

  2. Added support for `list-main-axis-gap`, `list-cross-axis-gap`.

- feat(web): The list element supports list-type with **flow**. ([#240](https://github.com/lynx-family/lynx-stack/pull/240))

  It supports all attributes and events under single, and also provides `full-span`.

  For detailed usage, please refer to the official website.

## 0.4.0

### Minor Changes

- refactor: remove web-elements/lazy and loadNewTag ([#123](https://github.com/lynx-family/lynx-stack/pull/123))

  - remove @lynx-js/web-elements/lazy
  - remove loadElement
  - remove loadNewTag callback

  **This is a breaking change**

  Now we removed the default lazy loading preinstalled in web-core

  Please add the following statement in your web project

  ```
  import "@lynx-js/web-elements/all";
  ```

### Patch Changes

- feat: never require the x-enable-xx-event attributes ([#157](https://github.com/lynx-family/lynx-stack/pull/157))

  After this commit, we do not need user to add `x-enable-xx-event` to enable corresponding events

- feat: add support for `<lynx-view/>` with shadowroot ([#198](https://github.com/lynx-family/lynx-stack/pull/198))

  add a minor logic in `<x-overlay-ng>` to be compatiable with the <lynx-view> with a shadowroot

- Updated dependencies [[`4c2ee65`](https://github.com/lynx-family/lynx-stack/commit/4c2ee65368eb4b39722ed36305101fe89a782b1a)]:
  - @lynx-js/web-elements-reactive@0.2.0

## 0.3.0

### Minor Changes

- feat: support `justify-content`, `align-self` in linear container ([#37](https://github.com/lynx-family/lynx-stack/pull/37))

  Now these two properties could work in a linear container.

  We don't transforms the `justify-content` and `align-self` to css vars any more.

  The previous version of `@lynx-js/web-core` won't work with current `@lynx-js/web-core` after this change.

### Patch Changes

- Support NPM provenance. ([#30](https://github.com/lynx-family/lynx-stack/pull/30))

- Updated dependencies [[`c617453`](https://github.com/lynx-family/lynx-stack/commit/c617453aea967aba702967deb2916b5c883f03bb)]:
  - @lynx-js/web-elements-reactive@0.1.1

## 0.2.4

### Patch Changes

- 1abf8f0: feat: `inline-text` is deprecated, now you can use `x-text` instead in `x-text`.
- 1abf8f0: fix: Removed the list-item style `contain: strict`. Previously we thought it would affect `content-visibility: auto`, but it turns out that this is wrong.

  Now, you don't need to specify the width and height of list-item, it will be stretched by the child elements.

- 1abf8f0: fix: do truncation layout calculation after fonts loaded
- 1abf8f0: refractor: x-foldview-ng gesture use pageX&pageY to replace the screenX&screenY
- 1abf8f0: fix: x-input should inherit color style
- 1abf8f0: feat: `inline-image` is deprecated, now you can use `x-image` instead in `x-text`.

## 0.2.3

### Patch Changes

- 5a19264: feat: x-canvas is deprecated.

  Since other platforms do not implement it and do not plan to implement it, we deprecate it.

- b26ed57: fix: x-foldview-ng \_\_headershowing add compatibility criteria for Android WebView.
- 1d4f831: fix: the x-input should inherit margin properties

## 0.2.2

### Patch Changes

- 7ac2b1c: fix: remote `x-overlay-ng #dialog[open] { display: contents; }` && add top for chrome87.

  dialog[open].style.display is actually not allowed to be set to contents, it is always block.
  But in chrome87 it is allowed to be set to contents by mistake, which will cause it to not occupy any space, so we remove `display: contents;` of x-overlay-ng.

- d17e7e5: fix: add `position: fixed` for x-overlay-ng dialog[open].

  The `position` property of the x-overlay-ng dialog (when open) defaults to `absolute` other than `fixed` on some devices.

## 0.2.1

### Patch Changes

- 46a18cd: chore: fix scrollbar style for scroll-view
- f068dce: fix: rename vertical property to isVertical for x-swiepr

## 0.2.0

### Minor Changes

- 49f7f0b: break: remove `bounces` support for <scroll-view>

  We removed the bounces support for scroll-view.

### Patch Changes

- 0c6e1bb: fix: set width&height with DPR
- a72b50f: fix: set background-color inherit of x-input::part(input), otherwise its background may cover its parent node.

## 0.1.6

### Patch Changes

- 5649861: fix(web): x-image the style of position, left, right, top, bottom should be inherit only when auto-size.
- 65ac6a2: fix: add transform, opacity, z-index, filter CSS Properties inherit when x-image auto-size is set.
- 875cfd3: fix(web): x-textarea is supposed to be not resizeable

## 0.1.5

### Patch Changes

- b2fd603: fix(web): pin the `justify-content` of x-swiper to be `flex-start`
- 3ebcb99: fix(web): the first child of `<x-overlay-ng />` should have `position: absolute`.

  On Safari 16.1, We should have `position: absolute` to show the overlay content correctly.

  The parent `<dialog />` already have `position: fixed`, therefore we could use a absolute position.

- c19bba8: fix: the default justify-content value should be `flex-start`

## 0.1.4

### Patch Changes

- 5c3f447: fix(web): x-image::part(img)img style position, tip, left, right, bottom change to be inherit, to fix the problem that x-image setting location does not work.
- addc058: fix: incorrect linear detect after chrome 130

  see https://chromestatus.com/feature/5242724333387776

- 90131cc: feat(web): x-text support scrollIntoView method.
- 75877ed: fix(web): the scroll-view is always a linear container

  After this commit, we don't need to use `@container` queries to apply linear container styles for `scroll-view`'s kids

  we use type selector directly.

## 0.1.3

### Patch Changes

- 9b99484: fix: blank inline-text in color:linear-gradient text element

  Before this commit, those parent text element with style `color:linear-gradient()` will cause empty content in children inline-text element

- f650509: fix: browser compatibility issues

  1. safari 17.2~18.0 issue

  `display:linear` doesn't work

  2. chrome < 99 issue

  text may be blank on these browsers

## 0.1.2

### Patch Changes

- 6a97751: fix: x-folview-ng x-axis scrolling on safari/firefox
- 55f73a2: fix: x-foldview-ng block y-axis js scroll for x-axis gesture

## 0.1.1

### Patch Changes

- ddc8c5a: fix(web): add @supports of @container to avoid crash less chrome 117.

## 0.1.0

### Minor Changes

- 3547621: feat(web): use `<lynx-wrapper/>` to replace `<div style="display:content"/>`
- bed4f24: feat(web): implement <x-list> with list-type="single"

  ## 1. RFC

  https://github.com/lynx-wg/lynx-stack/issues/106

  ## 2. Implementation differences with RFC

  ### paging-enabled

  deprecated, no need to implement

  ### layoutcomplete

  Triggered only after the first screen because using contentvisibilityautostatechange.

  Here, a setTimeout is set to trigger layoutcomplete 100ms after the content-visible property of **content** changes.

  > This is because content is the parent container of list-item, and content is always visible before list-item.
  > We cannot obtain the timing of all the successfully visible list-items on the screen, so 100ms is used to delay this behavior.

  ### event-scrolltoedge

  split bindscrolltoupperedge and bindscrooltolowerdge.

  ### event-scrolltoupper/lower

  Can be used with upper/lower-threshold-item-count.

  Attention, when the number of x-list children changes, scrolltoupper/lower will be re-triggered (if the new node is on the screen).

  ### getVisibleCells, layoutcomplete

  The returned cells may be an empty array, because there is a high probability that the contentvisibilityautostatechange event of list-item will not be captured when the first screen is displayed.

  ## 3. Tests not implemented

  ### HTML Tests

  1. event-layoutcomplete skipped webkit, firefox due to contentvisibilityautostatechange not propagate
  2. get-visible-cells skipped webkit, firefox due to contentvisibilityautostatechange not propagate

  ### React Tests

  1. lynx.createQuery not supported.

- b323923: feat(web): support **ReplaceElement, **CreateImage, \_\_CreateScrollView
- 39cf3ae: feat: improve performance for supporting linear layout

  Before this commit, we'll use `getComputedStyle()` to find out if a dom is a linear container.

  After this commit, we'll use the css variable cyclic toggle pattern and `@container style()`

  This feature requires **Chrome 111, Safari 18**.

  We'll provide a fallback implementation for firefox and legacy browsers.

  After this commit, your `flex-direction`, `flex-shrink`, `flex`, `flex-grow`, `flex-basis` will be transformed to a css variable expression.

- 2e0a780: feat: move LinearContainer to web-elements-compat

  In this commit, we're going to remove all LinearContainer Class from custom elements.

  It now relies on the `@container style(){}`, which is supported by chrome 111 and safari 18.

  For compating usage, `@lynx-js/web-elements-compat/LinearContainer` is provided.

  ```javascript
  import '@lynx-js/web-elements-compat/LinearContainer';
  import '@lynx-js/web-elements/all';
  ```

- f8d1d98: break: rename the `blur` and `focus` event to `lynxblur` and `lynxfocus` for x-input element

  To avoid sending duplicated events for focus, we'll rename them.

  **This is a breaking change**

- 81be6cf: feat(web): support `load` and `error` events for x-image and filter-image
  fix #66
- f8d1d98: feat: allow custom elements to be lazy loaded

  After this commit, we'll allow developer to define custom elements lazy.

  A new api `onElementLoad` will be added to the `LynxCard`.

  Once a new element is creating, it will be called with the tag name.

  There is also a simple way to use this feature

  ```javascript
  import { LynxCard } from '@lynx-js/web-core';
  import { loadElement } from '@lynx-js/web-elements/lazy';
  import '@lynx-js/web-elements/index.css';
  import '@lynx-js/web-core/index.css';
  import './index.css';

  const lynxcard = new LynxCard({
    ...beforeConfigs,
    onElementLoad: loadElement,
  });
  ```

- 5018d8f: feat: export more objects of web-elements
- 8c6eeb9: fix(web): rename x-swiper-itrm to swiper-item
- 1fe49a2: feat(web): add custom element x-audio-tt

  ## The behavior is different from the native x-audio-tt:

  - When src changes, resources will not be loaded immediately. Resources will only be loaded when the play and prepare methods are triggered.

  > This is because resource loading and decoding are two steps in native lynx, while only resource loading can be controlled in web.
  > So loading and decoding are handled on one side.

  - The code returned by the binderror event does not include -4

  ## Unimplemented properties:

  - autoplay
  - playertype
  - experimental-ios-async-prepare

  ## Unimplemented methods:

  - requestFocus
  - releaseFocus

### Patch Changes

- 987da15: fix: x-foldview-ng scrolling behavior

  - fix scrolling behavior on its sub dom-tree has x-refresh-view
  - fix scrolling behavior on its sub dom-tree has x-viewpager-ng

- 3e66349: fix: x-viewpager bindchange use scrollEnd to trigger; bindoffsetchange use scroll to trigger.
- 2b7a4fe: fix: exposure should track the interaction with the closest scroll able ancestor
- 461d965: fix(web): swiper specifies current and bindchange, may cause jitter problem and some layout problems.

  1. swiper specifies current and bindchange, may cause jitter problem.
  2. When there are current not 0 && circular, the first layout is not correct.
  3. When there are circular mode='carousel' attributes, the first paint position is not correct.
  4. swiper-item with border is not right, should use offsetWidth/offsetHeight.

- 7ee0dc1: fix(web): rename swiper-item to x-swiper-item
- 7c752d9: fix(web): two bugs of x-textarea and x-input:

  1. When inputting Chinese characters, you need to send an input event again after the input is completed.

  2. When the business input event is bound to the input event inside web-elements, the input event will be triggered twice by mistake, so stopImmediatePropagation needs to be prevented in the form

- 29e4684: fix: list use debounce scroll in safari instead of scrollend
- 33691cd: fix(web): the lynx-wrapper should not have any impact on layout and style

  Before this commit, there exists some css selectors like `custome-element > another-custom-element`

  This may cause an issue of the direct child is a `lynx-wrapper`

  We submit this commit to fix it.

- 2047658: fix: exposure

  fix the error on triggering exposure event

- 917e496: fix: x-viewpager-item-ng should not respond to position:absoulte

  add `position:relateive !important` for it.

- 532380d: fix: ::part()::after selector not work on chrome 100
- a41965d: fix: foldview horizontal scroll in safari
- a7a222b: fix(web): x-view-pager-ng

  1. select-index, initial-select-index should only selectTab if the element has a connectedCallback.
  2. add scroll-snap-stop to x-view-pager-ng, to slide only one element at one time.

- c0a482a: fix(web): split flex, because flex-basis of undefined will cause the property to invalid
- 314cb44: fix(web): x-textarea replace blur,focus with lynxblur,lynxfocus.
- e0854a8: fix(web): add scroll-snap-stop of viewpager-item
- e86bba0: fix(web): do not remove `"false"` value for dataset attributes

  fix #77

- f0a50b6: chore: add tolerence for ios 14

  close #81

- Updated dependencies [2e0a780]
- Updated dependencies [a1d0070]
- Updated dependencies [e170052]
- Updated dependencies [e86bba0]
  - @lynx-js/web-elements-reactive@0.1.0
