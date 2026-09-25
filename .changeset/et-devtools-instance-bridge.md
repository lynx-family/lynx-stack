---
"@lynx-js/react": patch
---

Expose the Element Template instance ↔ element mapping `@lynx-js/preact-devtools` needs: the main thread provides `getUniqueIdListByElementTemplateHandleId`, and the background thread emits `onBackgroundElementTemplateInstanceUpdateId` when an instance is re-keyed on hydration, so element highlight/selection works on Element Template pages.
