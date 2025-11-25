---
'@lynx-js/css-extract-webpack-plugin': patch
'@lynx-js/template-webpack-plugin': patch
---

Set main thread JS basename to `lepusCode.filename` in tasm encode data. It will ensure a filename is reported on MTS error without devtools enabled.
