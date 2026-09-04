---
"@lynx-js/rspeedy": patch
"@lynx-js/rsbuild-plugin": patch
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/template-webpack-plugin": patch
"@lynx-js/debug-metadata-rsbuild-plugin": patch
---

Accept `DEBUG=lynx` (and `lynx:*`, `lynx:template`) for the Lynx debug output and intermediates. It is the recommended form now that the plugins also run under Rslib and Rsbuild; `DEBUG=rspeedy` keeps working.
