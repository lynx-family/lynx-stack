---
"@lynx-js/react-rsbuild-plugin": patch
---

Keep `loadScript` exports reuse disabled when opting into entry re-evaluation on reload. This prevents older hosts from using another template's cached exports on the initial load.
