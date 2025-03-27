---
"@lynx-js/web-mainthread-apis": patch
"@lynx-js/web-core": patch
---

fix: inline style will be removed for value number `0`

the inline style value could be incorrectly removed for number value `0`;

For example, `flex-shrink:0` may be ignored.
