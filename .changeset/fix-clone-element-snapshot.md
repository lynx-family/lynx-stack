---
"@lynx-js/react": patch
---

Support `cloneElement` for more ReactLynx snapshot scenarios, including compiled snapshots, runtime-created snapshots, and repeated clones.

Cloning compiled snapshots still cannot replace children and will warn in that case. Use components or runtime-created snapshots when clone-time children replacement is needed.
