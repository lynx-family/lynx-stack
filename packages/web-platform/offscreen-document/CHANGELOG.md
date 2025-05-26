# @lynx-js/offscreen-document

## 0.0.4

### Patch Changes

- fix: remove all children after the innerHTML setter is called ([#850](https://github.com/lynx-family/lynx-stack/pull/850))

- refactor: code clean ([#897](https://github.com/lynx-family/lynx-stack/pull/897))

  rename many internal apis to make logic be clear:

  multi-thread: startMainWorker -> prepareMainThreadAPIs -> startMainThread -> createMainThreadContext(new MainThreadRuntime)
  all-on-ui: prepareMainThreadAPIs -> startMainThread -> createMainThreadContext(new MainThreadRuntime)

- perf: improve dom operation performance ([#881](https://github.com/lynx-family/lynx-stack/pull/881))

  - code clean for offscreen-document, cut down inheritance levels
  - add `appendChild` method for OffscreenElement, improve performance for append one node
  - bypass some JS getter for dumping SSR string

## 0.0.3

### Patch Changes

- feat: support OffscreenDocument.innerHTML ([#772](https://github.com/lynx-family/lynx-stack/pull/772))

## 0.0.2

### Patch Changes

- feat: support touch events ([#641](https://github.com/lynx-family/lynx-stack/pull/641))

## 0.0.1

### Patch Changes

- feat: support parentNode ([#625](https://github.com/lynx-family/lynx-stack/pull/625))
