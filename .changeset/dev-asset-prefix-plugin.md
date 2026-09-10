---
"@lynx-js/rsbuild-plugin": patch
---

Fix `dev.assetPrefix` set by another plugin being replaced with the dev server address. It was resolved from the original user config only, so a plugin pointing the Lynx client at a proxy or a tunnel had its value silently discarded.
