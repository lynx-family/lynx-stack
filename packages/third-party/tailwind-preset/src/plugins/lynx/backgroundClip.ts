// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createPlugin } from '../../helpers.js';

export const backgroundClip = createPlugin(({ addUtilities, corePlugins }) => {
  if (!corePlugins('backgroundClip')) return;
  addUtilities({
    '.bg-clip-border': { 'background-clip': 'border-box' },
    '.bg-clip-padding': { 'background-clip': 'padding-box' },
    '.bg-clip-content': { 'background-clip': 'content-box' },
    // Below are not supported by Lynx:
    // '.bg-clip-text': { 'background-clip': 'text' },
  });
});
