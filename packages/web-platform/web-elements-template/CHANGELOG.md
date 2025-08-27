# @lynx-js/web-elements-template

## 0.8.4

## 0.8.3

## 0.8.2

## 0.8.1

### Patch Changes

- fix: indicator dots' bg-color on safari 26 ([#1298](https://github.com/lynx-family/lynx-stack/pull/1298))

  https://bugs.webkit.org/show_bug.cgi?id=296048
  The animation name should be defined in the template

## 0.8.0

## 0.7.7

## 0.7.6

### Patch Changes

- perf: add loading="lazy" for image element ([#1056](https://github.com/lynx-family/lynx-stack/pull/1056))

  https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img#loading

## 0.7.5

## 0.7.4

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
