---
"@lynx-js/rsbuild-plugin": patch
"@lynx-js/rspeedy": patch
---

Lower destructuring by default to avoid an array rest bug in Safari before 14.1 and iOS before 14.5. SWC's object rest parameter transform can generate the affected array pattern, causing functions to fail before their body runs after production minification.
