---
"@lynx-js/template-webpack-plugin": patch
---

Keep the `CSS` custom sections of an external bundle as custom sections on web. They still ride the `StyleInfo` section, and are now also written under their names into the `CustomSectionsStyleInfo` section.
