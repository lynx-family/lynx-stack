---
"@lynx-js/template-webpack-plugin": patch
---

Do not let a CSS diagnostic take the build down on Windows.

`normalizeTasmSourcePath` passed every `file://` source straight to
`fileURLToPath`, which throws on win32 for a URL that carries no drive letter
(and on POSIX for a non-localhost host). The function already declares
`string | undefined` and every other branch degrades to `undefined`, so the
throw escaped an advisory code path and failed the whole compilation. It now
degrades the same way.
