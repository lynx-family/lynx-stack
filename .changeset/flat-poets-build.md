---
"@lynx-js/web-elements": patch
"@lynx-js/web-elements-template": patch
---

refactor: split shadowroot templates into a package

We're going to implement Lynx Web Platform's SSR based on the `shadowrootmode`.

`https://developer.mozilla.org/en-US/docs/Web/API/HTMLTemplateElement/shadowRootMode`

(chrome 111, firefox 123, safari 16.4)

This means those modern browsers are able to show the correct layout before the web components are defined.

To make this work, we have to split the shadowroot template string into a new package `@lynx-js/web-elements-template`.

No features affected.
