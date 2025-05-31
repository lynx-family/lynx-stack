// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useEffect, useState } from '@lynx-js/react';
import { t } from './utils.js';

function App() {
  if (__MAIN_THREAD__) {
    function saveI18nData(locale) {
      const __I18N_RESOURCE_TRANSLATION__ = _I18nResourceTranslation({
        locale,
        channel: '',
        fallback_url: '',
      });

      console.log(
        '__I18N_RESOURCE_TRANSLATION__',
        __I18N_RESOURCE_TRANSLATION__,
      );
      if (__I18N_RESOURCE_TRANSLATION__) {
        globalThis.__I18N__RESOURCES[locale] = __I18N_RESOURCE_TRANSLATION__;
      }

      // _ReFlushPage();
    }

    _AddEventListener('i18nResourceReady', function() {
      saveI18nData('en');
    });
    _AddEventListener('onLocaleChanged', function(obj, env) {
      saveI18nData(env.__globalProps[getI18nLanguageKey()]);
    });
    saveI18nData('en');
  }

  useEffect(() => {
    lynx.getJSModule('GlobalEventEmitter').addListener(
      'onI18nResourceReady',
      () => {
        console.log('lynx.getI18nResource', lynx.getI18nResource());
      },
    );
  }, []);

  return (
    <view
      style={{ width: '300px', height: '300px', backgroundColor: 'red' }}
    >
      <text>{t('hello')} {t('lynx')}</text>
    </view>
  );
}

root.render(<App></App>);
