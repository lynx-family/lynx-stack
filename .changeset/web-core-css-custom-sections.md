---
"@lynx-js/web-core": patch
---

Encode the custom sections whose `encoding` is `CSS` with the CSS encoder. They are written as a name-keyed map into the new `CustomSectionsStyleInfo` section instead of being kept as JSON in `CustomSections`.
