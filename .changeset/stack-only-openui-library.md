---
"@lynx-js/genui": minor
---

Added a build-wide condition for OpenUI libraries that only use `Stack` plus
caller-provided components, keeping the full catalog out of the bundle.
