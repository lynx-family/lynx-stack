---
"@lynx-js/lynx-stack-docs": patch
---

Generate standalone API pages only for shown packages and explicitly configured additional packages, rendering hidden-package references as plain text and retaining explicit source type names when unavailable imports resolve to any. Consumers must update handwritten links to hidden package pages.

Keep additional package pages independent of the plugin menu, preserving the testing environment pages without duplicating the Testing navigation entry.
