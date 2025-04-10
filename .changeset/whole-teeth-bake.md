---
"@lynx-js/web-elements": patch
---

fix: the `input` event of x-input with number type should have raw value

For `type:=number` x-input with typed value "2."

Before this commit: the value is "2"

After this commit the value is "2."
