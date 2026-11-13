---
'@lynx-js/genui': patch
---

Fix A2UI native bundle loading by removing BigInt operations and the global URL dependency from the bundled schema validator while preserving exact decimal multipleOf checks. Invalidate the schema build cache when dependency patches change.
