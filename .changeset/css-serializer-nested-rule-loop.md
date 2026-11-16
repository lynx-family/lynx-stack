---
"@lynx-js/css-serializer": patch
---

Fix `parse()` never returning when a rule nests two or more style rules in a row, and keep nested rules in source order.
