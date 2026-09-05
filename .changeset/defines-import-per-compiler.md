---
"@lynx-js/react-webpack-plugin": patch
---

Keep the lazy-chunk definitions import of one compiler from leaking into another compiler in the same process, which made builds with several environments fail intermittently with `Module not found: Can't resolve '<lazy module>.__lynx-react-defines.js'`.
