---
"@lynx-js/template-webpack-plugin": patch
"@lynx-js/react-webpack-plugin": patch
"@lynx-js/react": patch
---

Keep both layers of a lazy bundle that a `webpackChunkName` names. The name is the identity of a chunk group, so writing one collapsed the main-thread and the background compilation into a single chunk: the bundle shipped with an empty `lepusCode`, and its intermediate outputs landed outside of `.lynx/lazy-bundle/<name>/`. The transform now appends `-react__<layer>` to a user-written name and the plugin strips it again, the way it did for the names the transform used to inject, so a named lazy bundle is built exactly like an unnamed one.
