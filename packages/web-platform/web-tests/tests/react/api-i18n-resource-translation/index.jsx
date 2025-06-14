// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useState, root, useEffect } from '@lynx-js/react';
function App() {
  if (__MAIN_THREAD__) {
    function saveI18nData() {
      const __I18N_RESOURCE_TRANSLATION__ = _I18nResourceTranslation({
        locale: 'en',
        channel: '',
        fallback_url: '',
      });

      console.log(
        `i18nResource:${JSON.stringify(__I18N_RESOURCE_TRANSLATION__)}`,
      );
    }

    _AddEventListener('i18nResourceReady', saveI18nData);
    saveI18nData();
  }

  return <view />;
}
root.render(<App />);
