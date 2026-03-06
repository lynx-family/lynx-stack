---
"@lynx-js/web-elements": minor
---

feat: reimplement `XFoldViewNg` scrolling using CSS transforms and custom scroll handling, updating related events, styles, and tests.

this breaks https://github.com/lynx-family/lynx-stack/pull/878

The position:fixed elements in x-foldview-header-ng and x-foldview-slot-ng will be affected.
