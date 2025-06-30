---
"@lynx-js/web-constants": patch
"@lynx-js/web-elements": patch
---

fix: in lynx-view all-on-ui mode, the input event of input and textarea is triggered twice, and the first e.detail is a string, which does not conform to the expected data format.
