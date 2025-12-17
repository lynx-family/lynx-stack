// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createPlugin } from '../../helpers.js';
import type { Plugin } from '../../helpers.js';

export const whitespace: Plugin = createPlugin(({ addUtilities }) => {
  addUtilities({
    '.whitespace-normal': { 'white-space': 'normal' },
    '.whitespace-nowrap': { 'white-space': 'nowrap' },
    // Below are not supported by Lynx:
    // '.whitespace-pre': { 'white-space': 'pre' },
    // '.whitespace-pre-line': { 'white-space': 'pre-line' },
    // '.whitespace-pre-wrap': { 'white-space': 'pre-wrap' },
    // '.whitespace-break-spaces': { 'white-space': 'break-spaces' },
  });
});
