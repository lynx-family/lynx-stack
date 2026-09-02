---
"@lynx-js/rspeedy": patch
"@lynx-js/rsbuild-plugin": patch
---

Enable `output.sourceMap.css` by default only in Lynx environments, so web builds no longer emit unused CSS `.map` files into the intermediate directory.
