// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createPlugin } from '../../helpers.js';
import type { Plugin } from '../../helpers.js';

export const alignContent: Plugin = createPlugin(({ addUtilities }) => {
  addUtilities({
    '.content-center': { 'align-content': 'center' },
    '.content-start': { 'align-content': 'flex-start' },
    '.content-end': { 'align-content': 'flex-end' },
    '.content-between': { 'align-content': 'space-between' },
    '.content-around': { 'align-content': 'space-around' },
    '.content-stretch': { 'align-content': 'stretch' },
    // Below are not supported by Lynx:
    // '.content-normal': { 'align-content': 'normal' },
    // '.content-baseline': { 'align-content': 'baseline' },
    // '.content-evenly': { 'align-content': 'space-evenly' },
  });
});
