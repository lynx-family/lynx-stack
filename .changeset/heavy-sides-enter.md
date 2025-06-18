---
"@lynx-js/web-mainthread-apis": patch
"@lynx-js/web-worker-runtime": patch
"@lynx-js/web-constants": patch
"@lynx-js/web-core": patch
---

feat: supports `lynx.getI18nResource()` and `onI18nResourceReady` event in bts.

- `lynx.getI18nResource()` can be used to get i18nResource in bts, it has two data sources:
  - the result of `_I18nResourceTranslation()`
  - lynx-view `updateI18nResources(data: InitI18nResources, options: I18nResourceTranslationOptions)`, it will be matched to the correct i8nResource as a result of `lynx.getI18nResource()`
- `onI18nResourceReady` event can be used to listen `_I18nResourceTranslation` and lynx-view `updateI18nResources` execution.
