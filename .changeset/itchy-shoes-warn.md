---
"@lynx-js/web-mainthread-apis": patch
"@lynx-js/web-constants": patch
"@lynx-js/web-core": patch
---

fix: avoid duplicate style transformation

After this commit, we use DAG methods to handle the styleInfos
