---
"@lynx-js/template-webpack-plugin": patch
---

Stop emitting a lazy bundle for a dynamic import whose module is also imported statically. Rspack puts such a module in the initial chunk and drops the now-empty async chunk, but keeps the chunk group, so the template was still emitted with an empty payload that nothing loads -- and the web target crashed encoding it.
