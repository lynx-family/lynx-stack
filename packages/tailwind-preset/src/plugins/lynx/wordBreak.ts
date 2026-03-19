// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createPlugin } from '../../helpers.js';
import type { Plugin } from '../../helpers.js';

export const wordBreak: Plugin = createPlugin(({ addUtilities }) => {
  addUtilities({
    '.break-normal': { 'word-break': 'normal' },
    '.break-all': { 'word-break': 'break-all' },
    // Lynx does not support 'overflow-wrap'
    // '.break-normal': { 'overflow-wrap': 'normal', 'word-break': 'normal' },
    // '.break-words': { 'overflow-wrap': 'break-word' },
    // Lynx does not support 'word-break': 'keep-all'
    // '.break-keep': { 'word-break': 'keep-all' },
  });
});
