---
"@lynx-js/web-mainthread-apis": patch
"@lynx-js/web-worker-runtime": patch
"@lynx-js/web-core-server": patch
"@lynx-js/web-constants": patch
"@lynx-js/web-core": patch
---

feat: add `_I18nResourceTranslation` api in mts && `init-i18n-resources` attr, `i18nResourceMissed` event of lynx-view.

`init-i18n-resource` is the complete set of i18nResources that need to be maintained on the container side. Note: You need to pass this value when lynx-view is initialized.

You can use `_I18nResourceTranslation` in MTS to get the corresponding i18nResource from `init-i18n-resources`. If it is undefined, the `i18nResourceMissed` event will be dispatched.

```js
// ui thread
lynxView.initI18nResources = [
  {
    options: {
      locale: 'en',
      channel: '1',
      fallback_url: '',
    },
    resource: {
      hello: 'hello',
      lynx: 'lynx web platform1',
    },
  },
];
lynxView.addEventListener('i18nResourceMissed', (e) => {
  console.log(e);
});

// mts
_I18nResourceTranslation({
  locale: 'en',
  channel: '1',
  fallback_url: '',
});
```
