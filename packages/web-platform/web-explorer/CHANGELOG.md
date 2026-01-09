# @lynx-js/web-explorer

## 0.0.15

### Patch Changes

- fix: web-explorer needs to actively send an iframeReady message to the parent, the parent uses `iframe load` listener cannot guarantee that the `message-listener` will complete execution. ([#2001](https://github.com/lynx-family/lynx-stack/pull/2001))

## 0.0.14

### Patch Changes

- chore: update web-elements version of web-explorer ([#1962](https://github.com/lynx-family/lynx-stack/pull/1962))

## 0.0.13

### Patch Changes

- feat: builtinTagTransformMap add `'x-input-ng': 'x-input'` ([#1932](https://github.com/lynx-family/lynx-stack/pull/1932))

## 0.0.12

### Patch Changes

- feat: update @lynx-js/web-elements to 0.8.10 ([#1914](https://github.com/lynx-family/lynx-stack/pull/1914))

## 0.0.11

### Patch Changes

- feat: builtinTagTransformMap add `'input': 'x-input'` ([#1907](https://github.com/lynx-family/lynx-stack/pull/1907))

## 0.0.10

### Patch Changes

- chore: update `@lynx-js/lynx-core` to `0.1.3`, `@lynx-js/web-core` to `0.17.1`. ([#1839](https://github.com/lynx-family/lynx-stack/pull/1839))

## 0.0.9

### Patch Changes

- chore: update dependencies: ([#868](https://github.com/lynx-family/lynx-stack/pull/868))

  - @lynx-js/web-elements@0.7.2
  - @lynx-js/web-core@0.13.2

## 0.0.8

### Patch Changes

- chore: import qr-scanner from unpkg ([#815](https://github.com/lynx-family/lynx-stack/pull/815))

## 0.0.7

### Patch Changes

- feat: use nativeModulesPath instead of nativeModulesMap to lynx-view. ([#668](https://github.com/lynx-family/lynx-stack/pull/668))

- fix: fork @vant/touch-emulator and make it work with shadowroot ([#662](https://github.com/lynx-family/lynx-stack/pull/662))

- fix: loading errors caused by script import order ([#665](https://github.com/lynx-family/lynx-stack/pull/665))

- chore: update homepage ([#645](https://github.com/lynx-family/lynx-stack/pull/645))

## 0.0.6

### Patch Changes

- fix: allow lynxjs.org to access native modules ([#599](https://github.com/lynx-family/lynx-stack/pull/599))

## 0.0.5

### Patch Changes

- fix: create a new lynx-view for lynxjs.org ([#566](https://github.com/lynx-family/lynx-stack/pull/566))

- fix: blank screen issue for 0.0.4 ([#543](https://github.com/lynx-family/lynx-stack/pull/543))

## 0.0.4

### Patch Changes

- feat: add a touch emulator that allows the explorer to respond to touch events triggered by mouse events ([#516](https://github.com/lynx-family/lynx-stack/pull/516))

## 0.0.3

### Patch Changes

- chore: update dependencies ([#123](https://github.com/lynx-family/lynx-stack/pull/123))

## 0.0.2

### Patch Changes

- Support NPM provenance. ([#30](https://github.com/lynx-family/lynx-stack/pull/30))

## 0.0.1

### Patch Changes

- 1abf8f0: feat: add a install prompt dialog

  We will detect if the PWA installation is supported by current UA.
  If yes, we will show a tiny banner at the bottom of app to encourage user install us on their homepage.

- 1abf8f0: fix: the GO button
- 1abf8f0: feat: add nav banner
- 1abf8f0: fix: publish manifest.json
- 1abf8f0: fix: publish essential files
- 1abf8f0: feat: support auto theme and update new home page
