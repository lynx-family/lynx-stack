// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createInstance, type i18n as I18nInstance } from 'i18next';

import { loadI18nextTranslations } from '../../../../src/runtime.js';

export const i18n: I18nInstance = createInstance();

void i18n.init({
  lng: 'en',
  fallbackLng: 'en',
  compatibilityJSON: 'v4',
  resources: loadI18nextTranslations(),
});
