---
"@lynx-js/tailwind-preset": minor
---

Added `group-*`, `peer-*`, and `parent-*` modifiers (ancestor, sibling, and direct-parent scopes) for `uiVariants` plugin.

Fixed prefix handling in prefixed projects — `ui-*` state markers are not prefixed, while scope markers (`.group`/`.peer`) honor `config('prefix')`.

**BREAKING**: Removed slash-based naming modifiers on self (non-standard); slash modifiers remain supported for scoped markers (e.g. `group/menu`, `peer/tab`).

Bumped peer dependency to `tailwindcss@^3.4.0` (required for use of internal features).
