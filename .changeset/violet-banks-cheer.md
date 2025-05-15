---
"@lynx-js/web-elements-reactive": patch
---

feat: do not create shadowroot if there already have one

the shadowroot may already be created by

https://developer.mozilla.org/en-US/docs/Web/API/HTMLTemplateElement/shadowRootMode
