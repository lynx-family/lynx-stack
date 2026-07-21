---
"@lynx-js/debug-metadata-rsbuild-plugin": patch
---

Reduce build-time overhead: memoize the chunk release key, and read the commit and worktree root in one `git rev-parse` spawn instead of two.
