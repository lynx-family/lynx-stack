# @lynx-js/lynx-runtime

## 0.0.1

### Patch Changes

- Add prebuilt, self-contained ES2017 IIFE scripts (`@lynx-js/lynx-runtime/iife/mts` and `@lynx-js/lynx-runtime/iife/bts`) exposing `var LynxRuntime` for build-free `.lynxml` `<script thread="main">` and `<script thread="background">` blocks, along with a version-matched package skill (`@lynx-js/lynx-runtime/skill`). ([#4388](https://github.com/lynx-family/lynx-stack/pull/4388))

- Add `@lynx-js/lynx-runtime` as an early `0.0.x` preview package (public APIs are not yet guaranteed to be stable prior to formal RFC stabilization), providing DSL-neutral MTS (`@lynx-js/lynx-runtime/mts`) and page-scoped BTS (`@lynx-js/lynx-runtime/bts`) host primitives covering initial data, incremental/reset updates, reloads, `GlobalProps`, page destruction lifecycle, `ContextProxy` peer messages, `GlobalEventEmitter` subscriptions (`onGlobalEvent`), raw BTS event dispatch (`setEventHandler`), root element flushing (`flushElementTree`), `SystemInfo`, and performance pipeline timing. ([#4376](https://github.com/lynx-family/lynx-stack/pull/4376))
