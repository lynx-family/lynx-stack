// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createPlugin } from '../../helpers.js';
import type { Plugin } from '../../helpers.js';

export const justifyContent: Plugin = createPlugin(({ addUtilities }) => {
  addUtilities({
    '.justify-start': { 'justify-content': 'flex-start' },
    '.justify-end': { 'justify-content': 'flex-end' },
    '.justify-center': { 'justify-content': 'center' },
    '.justify-between': { 'justify-content': 'space-between' },
    '.justify-around': { 'justify-content': 'space-around' },
    '.justify-evenly': { 'justify-content': 'space-evenly' },
    '.justify-stretch': { 'justify-content': 'stretch' },
    // Lynx does not support 'normal'
    // '.justify-normal': { 'justify-content': 'normal' },
  });
});
