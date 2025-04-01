---
"@lynx-js/web-constants": patch
"@lynx-js/web-core": patch
"@lynx-js/web-worker-runtime": patch
---

feat: onNapiModulesCall function add new param: `dispatchNapiModules`, napiModulesMap val add new param: `handleDispatch`.

Now you can use them to actively communicate to napiModules (background thread) in onNapiModulesCall (ui thread).
