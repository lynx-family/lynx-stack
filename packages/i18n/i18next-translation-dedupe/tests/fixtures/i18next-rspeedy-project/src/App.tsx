// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { i18n } from './i18n.js';

export function App() {
  return <text>{String(i18n.t('hello'))}</text>;
}
