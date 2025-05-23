# @lynx-js/web-elements-template

## 0.7.3

## 0.7.2

### Patch Changes

- refactor: split shadowroot templates into a package ([#811](https://github.com/lynx-family/lynx-stack/pull/811))

  We're going to implement Lynx Web Platform's SSR based on the `shadowrootmode`.

  `https://developer.mozilla.org/en-US/docs/Web/API/HTMLTemplateElement/shadowRootMode`

  (chrome 111, firefox 123, safari 16.4)

  This means those modern browsers are able to show the correct layout before the web components are defined.

  To make this work, we have to split the shadowroot template string into a new package `@lynx-js/web-elements-template`.

  No features affected.
