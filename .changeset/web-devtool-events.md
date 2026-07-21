---
"@lynx-js/web-core": minor
---

Add a bidirectional per-card devtool event channel. Background scripts can use `lynx.getDevtool()` to dispatch events to a `devtoolMessage` event on `<lynx-view>` and listen for events sent through `lynxView.sendDevtoolEvent()`.
