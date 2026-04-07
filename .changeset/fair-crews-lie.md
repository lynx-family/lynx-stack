---
"@lynx-js/react": patch
---

Improve `shake.removeCall` and `shake.removeCallParams` in the React transform so they also match aliased runtime imports such as `import { useEffect as myUseEffect } ...` and member calls such as `ReactLynxRuntime.useEffect(...)` from default or namespace runtime imports.
