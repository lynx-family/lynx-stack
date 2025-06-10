---
"@lynx-js/react": patch
"create-rspeedy": patch
---

Fix a bug in ReactLynx Testing Library that rendered snapshot of inline style was normalized incorrectly (eg. `flex:1` was normalized to `flex: 1 1 0%;` incorrectly).
