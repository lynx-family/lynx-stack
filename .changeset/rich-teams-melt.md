---
"@lynx-js/web-elements": patch
---

fix: x-markdown inline view injection no longer queries light DOM children when the content attribute changes. Consumers must now pre-set `slot="{id}"` on the child element they want to project into `inlineview://{id}`.
