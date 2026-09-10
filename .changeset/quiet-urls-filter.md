---
"@lynx-js/rsbuild-plugin": patch
---

Use the active Rsbuild environments and their resolved entries when printing dev server URLs. This fixes startup failures when `--environment` excludes an environment declared in the configuration.
