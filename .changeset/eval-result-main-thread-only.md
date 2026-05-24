---
"@lynx-js/react-webpack-plugin": patch
---

Inject the `lynxProcessEvalResult` runtime module only into main-thread chunks. The previous guard checked the chunk name for `:background`, which never matched the actual chunk names (`main__background`, `foo.js-react__background`), so the runtime was duplicated into background and async background chunks.
