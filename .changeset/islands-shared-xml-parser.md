---
"@lynx-js/islands": minor
---

Use `parseLynxXML` from `@lynx-js/lynx-xml/parser` directly in exposed-source configuration via `parse`. Remove the `compileLynxXmlIsland` adapter, its build subpath, and the direct Web Core dependency. Convert raw CSS in the Islands build layer while preserving XML parse diagnostics and rejecting unsupported stylesheet rules.
