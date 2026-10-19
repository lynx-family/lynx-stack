---
"@lynx-js/genui": patch
---

Pin Marked to 14.0.0 so dependency updates preserve compatibility with the OpenUI Playground Unicode transform. The transform expands Unicode punctuation properties during Playground builds so OpenUI bundles can initialize on PrimJS without Unicode property escape support.
