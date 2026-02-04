---
"@lynx-js/testing-environment": patch
"@lynx-js/react-webpack-plugin": patch
"@lynx-js/react": patch
---

Remove element api calls alog by default, and only enable it when `__ALOG_ELEMENT_API__` is defined to `true` or environment variable `REACT_ALOG_ELEMENT_API` is set to `true`.
