---
"@lynx-js/css-serializer": patch
---

Replace `node:path` with `pathe` in `generateHref` so the package can be bundled for browsers.

Hrefs resolved from a `projectRoot` or `filename` containing a backslash change, because `pathe` normalizes Windows separators on every platform. Pure POSIX inputs, including the defaults, are unaffected.
