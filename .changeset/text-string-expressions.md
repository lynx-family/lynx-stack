---
"@lynx-js/react-webpack-plugin": patch
---

Optimize single string literal and template literal children of `<text>` into `text` attributes when `engineVersion` is at least 3.1, avoiding separate raw text nodes while preserving expression values and updates.
