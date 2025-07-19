---
"@lynx-js/react": patch
---

Fix the `rerender` function in the testing library to keep the current `<page/>` element used. After this fix it will behavior the same with `react-testing-library`'s `rerender` function.
