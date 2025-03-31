---
"@lynx-js/react": patch
---

fix: ensure ref lifecycle events run after firstScreen in the background thread

This patch fixes an issue where ref lifecycle events were running before firstScreen events in the background thread async render mode, which could cause refs to be undefined when components try to access them.
