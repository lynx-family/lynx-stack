---
"@lynx-js/web-core": patch
---

fix: will recopy these properties: `initData` and `globalProps` and `initI18nResources` and `overrideLynxTagToHTMLTagMap` and `nativeModulesMap` and `napiModulesMap`, ensuring that the values ​​used at the time of binding are always used within Lynx-view, preventing updates to these referenced objects from affecting the values ​​within Lynx-view.
