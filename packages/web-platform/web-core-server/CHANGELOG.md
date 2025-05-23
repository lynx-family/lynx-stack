# @lynx-js/web-core-server

## 0.13.3

### Patch Changes

- refactor: code clean ([#897](https://github.com/lynx-family/lynx-stack/pull/897))

  rename many internal apis to make logic be clear:

  multi-thread: startMainWorker -> prepareMainThreadAPIs -> startMainThread -> createMainThreadContext(new MainThreadRuntime)
  all-on-ui: prepareMainThreadAPIs -> startMainThread -> createMainThreadContext(new MainThreadRuntime)

- feat: support to dump ssrEncode string ([#876](https://github.com/lynx-family/lynx-stack/pull/876))

- perf: improve dom operation performance ([#881](https://github.com/lynx-family/lynx-stack/pull/881))

  - code clean for offscreen-document, cut down inheritance levels
  - add `appendChild` method for OffscreenElement, improve performance for append one node
  - bypass some JS getter for dumping SSR string

- feat: dump dehydrate string with shadow root template ([#838](https://github.com/lynx-family/lynx-stack/pull/838))

## 0.13.2

### Patch Changes

- perf: use v8 hint for generated javascript file ([#807](https://github.com/lynx-family/lynx-stack/pull/807))

  https://v8.dev/blog/explicit-compile-hints

- fix: corrupt mainthread module cache ([#806](https://github.com/lynx-family/lynx-stack/pull/806))

- feat: improve template js loading ([#807](https://github.com/lynx-family/lynx-stack/pull/807))

  now we will create temp js file based on the new `templateName` argument.
