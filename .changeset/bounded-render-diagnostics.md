---
"@lynx-js/react": patch
---

Keep Element API and first-screen hydration diagnostics from interrupting rendering. Element API logs and traces summarize arguments with bounded previews, and hydration logs record progress and patch dispatch without dumping the trees.
