---
"@lynx-js/rsbuild-plugin": patch
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/vanilla-rsbuild-plugin": patch
"@lynx-js/rspeedy": patch
---

Honor `output.distPath.intermediate`. The Lynx build engine now resolves the intermediate directory, so the option is no longer ignored by the plugins that emit a Lynx bundle.
