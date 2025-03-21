---
"@lynx-js/react": minor
---

Improved rendering performance by batching updates sent to the main thread in a single render pass. This optimization reduces redundant layout operations on the main thread, accelerates rendering, and prevents screen flickering.

**BREAKING CHANGE**: This commit changes the behavior of Timing API. Previously, timing events were fired for each update individually. With the new batching mechanism, timing events related to the rendering pipeline will now be triggered once per render cycle rather than for each individual update, affecting applications that rely on the previous timing behavior.
