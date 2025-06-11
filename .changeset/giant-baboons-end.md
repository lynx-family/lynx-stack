---
"@lynx-js/web-mainthread-apis": patch
"@lynx-js/web-worker-runtime": patch
"@lynx-js/web-core-server": patch
"@lynx-js/web-constants": patch
"@lynx-js/web-core": patch
---

feat: add `_I18nResourceTranslation` api in mts && `init-i18n-resource` of lynx-view.

If you need to use `_I18nResourceTranslation`, you need to add napiModulesMap and onNapiModulesCall. Here is an example:

```js
lynxView.napiModulesMap = {
  i18n: URL.createObjectURL(
    new Blob(
      [`export default function(NapiModules, NapiModulesCall) {
    return {
      async getI18nResourceByNative(options) {
        const handledData = await NapiModulesCall('getI18nResourceByNative', options);
        return handledData;
      },
    };
  };`],
      { type: 'text/javascript' },
    ),
  ),
};
lynxView.onNapiModulesCall = async (
  name,
  data,
  moduleName,
  lynxView,
  dispatchNapiModules,
) => {
  if (moduleName === 'i18n') {
    if (name === 'getI18nResourceByNative') {
      // mock fetch
      // You only need to replace the mock fetch with the actual i18n resource request.
      await wait(1000);
      if (data.locale = 'en') {
        return {
          data: {
            hello: 'hello',
            lynx: 'lynx web platform',
          },
        };
      }
    }
  }
};
```

If the web container has cached i18nResource and you want to use that resource first, you can pass `init-i18n-resource` to lynx-view:

```js
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
```
