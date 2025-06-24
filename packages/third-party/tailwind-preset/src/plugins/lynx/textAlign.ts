// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createPlugin } from '../../helpers.js';

export const textAlign = createPlugin(({ addUtilities }) => {
  addUtilities({
    '.text-left': { 'text-align': 'left' },
    '.text-center': { 'text-align': 'center' },
    '.text-right': { 'text-align': 'right' },
    '.text-start': { 'text-align': 'start' },
    '.text-end': { 'text-align': 'end' },
    // Below are not supported by Lynx:
    // '.text-justify': { 'text-align': 'justify' },
  });
});
