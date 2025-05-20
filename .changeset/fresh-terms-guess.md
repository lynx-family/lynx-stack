---
"@lynx-js/web-elements": patch
---

refactor: allow elements to be rendered before :defined

Before this commit, we don't allow developers to render these elements before they're defined.

In this commit, we will remove these restrictions.
