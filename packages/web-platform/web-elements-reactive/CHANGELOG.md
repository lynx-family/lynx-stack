# @lynx-js/web-elements-reactive

## 0.2.1

### Patch Changes

- Lazy load `templateElement` ([#286](https://github.com/lynx-family/lynx-stack/pull/286))

## 0.2.0

### Minor Changes

- feat: add new decorator `registerEventEnableStatusChangeHandler` ([#157](https://github.com/lynx-family/lynx-stack/pull/157))

  example

  ```typescript
  @registerEventEnableStatusChangeHandler('load')
   #enableLoadEvent(status:boolean) {
     if (status) {
       this.#getImg().addEventListener('load', this.#teleportLoadEvent, {
         passive: true,
       });
     } else {
       this.#getImg().removeEventListener('load', this.#teleportLoadEvent);
     }
   }
  ```

  After this commit, we override the `HTMLElement.addEventListener` and the `HTMLElement.removeEventListner` to know if there is any listener attached on current element.

  If event should be enabled/disabled, the callback will be invoked.

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
