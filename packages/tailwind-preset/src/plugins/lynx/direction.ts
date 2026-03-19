// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createPlugin } from '../../helpers.js';
import type { Plugin } from '../../helpers.js';

export const direction: Plugin = createPlugin(({ addUtilities }) => {
  addUtilities({
    '.normal': { direction: 'normal' },
    '.ltr': { direction: 'ltr' },
    '.rtl': { direction: 'rtl' },
    '.lynx-rtl': { direction: 'lynx-rtl' },
  });
});
