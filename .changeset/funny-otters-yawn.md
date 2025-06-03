---
"@lynx-js/web-mainthread-apis": patch
"@lynx-js/web-constants": patch
"@lynx-js/web-core": patch
"@lynx-js/web-core-server": patch
---

refactor: save dataset on an attribute

On lynx, the `data-*` attributes have different behaviors than the HTMLElement has.

The dataset will be treated as properties, the key will not be applied the camel-case <-> hyphenate name transformation.

Before this commit we use it as a runtime data, but after this commit we will use encodeURI(JSON.stringify(dataset)) to encode it as a string.
