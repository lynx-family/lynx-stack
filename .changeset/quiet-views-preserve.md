---
'@lynx-js/web-core': patch
---

Preserve `nativeModulesMap` assigned to a `<lynx-view>` before the custom element is defined or upgraded, so custom native modules remain available when the view initializes.
