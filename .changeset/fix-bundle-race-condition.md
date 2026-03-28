---
"@lynx-js/web-core": patch
---

fix(web-core): avoid partial bundle loading and double fetching when fetchBundle is called concurrently for the same url.
