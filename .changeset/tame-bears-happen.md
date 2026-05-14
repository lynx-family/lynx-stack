---
"@lynx-js/a2ui-reactlynx": patch
---

Fix `Column` template rendering so nested bindings keep the correct `dataContextPath`, and preserve the caller-provided context in `NodeRenderer` instead of overwriting it from the stored component snapshot.
