---
"@lynx-js/react": patch
"@lynx-js/react-umd": patch
---

Fix Fast Refresh for class components with subscriptions. Updated class components remount, disposing of the old instance and resetting the class subtree's local state.
