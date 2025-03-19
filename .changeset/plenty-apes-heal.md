---
"@lynx-js/web-mainthread-apis": patch
"@lynx-js/web-worker-runtime": patch
"@lynx-js/web-constants": patch
"@lynx-js/web-core": patch
---

refactor: remove customelement defined detecting logic

Before this commit, for those element with tag without `-`, we always try to detect if the `x-${tagName}` is defined.

After this commit, we pre-define a map(could be override by the `overrideLynxTagToHTMLTagMap`) to make that transformation for tag name.

This change is a path to SSR and the MTS support.
