---
"@lynx-js/web-core": patch
---

Add the `is-profiling` attribute and `isProfiling` property to `<lynx-view>`. `lynx.performance.isProfileRecording()` now returns `true` only when profiling is explicitly enabled for the view and browser User Timing is available. Profiling is off by default, and changes propagate to both runtime threads without reloading the view.
