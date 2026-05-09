---
"@lynx-js/react": patch
---

Clear transient snapshot child props when removed snapshot subtrees are detached, preventing compiled `$*` child references from retaining deleted list holder or list item subtrees after removal.
