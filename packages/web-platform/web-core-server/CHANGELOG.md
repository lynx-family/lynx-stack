# @lynx-js/web-core-server

## 0.13.2

### Patch Changes

- perf: use v8 hint for generated javascript file ([#807](https://github.com/lynx-family/lynx-stack/pull/807))

  https://v8.dev/blog/explicit-compile-hints

- fix: corrupt mainthread module cache ([#806](https://github.com/lynx-family/lynx-stack/pull/806))

- feat: improve template js loading ([#807](https://github.com/lynx-family/lynx-stack/pull/807))

  now we will create temp js file based on the new `templateName` argument.
