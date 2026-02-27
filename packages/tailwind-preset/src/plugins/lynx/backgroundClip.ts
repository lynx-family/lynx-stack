// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createPlugin } from '../../helpers.js';
import type { Plugin } from '../../helpers.js';

export const backgroundClip: Plugin = createPlugin(
  ({ addUtilities }) => {
    addUtilities({
      '.bg-clip-border': { 'background-clip': 'border-box' },
      '.bg-clip-padding': { 'background-clip': 'padding-box' },
      '.bg-clip-content': { 'background-clip': 'content-box' },
      // Below are not supported by Lynx:
      // '.bg-clip-text': { 'background-clip': 'text' },
    });
  },
);
