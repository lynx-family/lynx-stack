// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createPlugin } from '../../helpers.js';
import type { Plugin } from '../../helpers.js';

export const overflow: Plugin = createPlugin(({ addUtilities }) => {
  addUtilities({
    '.overflow-hidden': { overflow: 'hidden' },
    '.overflow-visible': { overflow: 'visible' },
    '.overflow-x-hidden': { 'overflow-x': 'hidden' },
    '.overflow-y-hidden': { 'overflow-y': 'hidden' },
    '.overflow-x-visible': { 'overflow-x': 'visible' },
    '.overflow-y-visible': { 'overflow-y': 'visible' },
    // Below are not supported by Lynx
    // '.overflow-auto': { overflow: 'auto' },
    // '.overflow-scroll': { overflow: 'scroll' },
    // '.overflow-x-scroll': { 'overflow-x': 'scroll' },
    // '.overflow-y-scroll': { 'overflow-y': 'scroll' },
    // '.overflow-clip': { overflow: 'clip' },
    // '.overflow-x-clip': { 'overflow-x': 'clip' },
    // '.overflow-y-clip': { 'overflow-y': 'clip' },
    // '.overflow-x-auto': { 'overflow-x': 'auto' },
    // '.overflow-y-auto': { 'overflow-y': 'auto' },
  });
});
