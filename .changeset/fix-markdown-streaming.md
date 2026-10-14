---
"@lynx-js/web-elements": patch
---

Fix x-markdown rendering when content is appended rapidly. Preserve Markdown context across updates, show appended text without waiting for input to stop, and retain typewriter progress while continuing playback as new content arrives.
