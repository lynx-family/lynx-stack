---
"@lynx-js/web-mainthread-apis": minor
"@lynx-js/web-worker-runtime": minor
"@lynx-js/web-constants": minor
"@lynx-js/web-core": minor
---

refractor: remove entryId concept

After the PR #198
All contents are isolated by a shadowroot.
Therefore we don't need to add the entryId selector to avoid the lynx-view's style taking effect on the whole page.
