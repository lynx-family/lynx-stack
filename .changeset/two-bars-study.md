---
"@lynx-js/web-mainthread-apis": minor
"@lynx-js/web-worker-runtime": minor
"@lynx-js/web-constants": minor
"@lynx-js/web-elements": minor
"@lynx-js/web-core": minor
---

refactor: move exposure system to web-core

**THIS IS A BREAKING CHANGE**

**You'll need to upgrate your @lynx-js/web-elements to >= 0.8.0**

For SSR and better performance, we moved the lynx's exposure system from web-element to web-core.

Before this commit, we create Intersection observers by creating HTMLElements.

After this commit, we will create such Intersection observers after dom stabled.

Also, the setInterval for exposure has been removed, now we use an on time lazy timer for such features.
