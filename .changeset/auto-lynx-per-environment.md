---
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/rsbuild-plugin": patch
"@lynx-js/rspeedy": patch
---

Do not apply the Lynx build engine again when `pluginLynx` is registered on an environment rather than globally, which silently replaced the options it was given.
