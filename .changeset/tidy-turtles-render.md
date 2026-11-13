---
'@lynx-js/genui': patch
---

Fix A2UI native bundle loading by removing BigInt operations and the global URL dependency from the bundled schema validator while preserving exact decimal multipleOf checks. Invalidate the schema build cache when dependency patches change.

Make A2UI number, currency, date, and plural formatting work without Intl. Remove DateTimeInput's replaceAll dependency and add createBasicFunctions for per-catalog native URL navigation callbacks. Report unavailable navigation instead of silently ignoring it.
