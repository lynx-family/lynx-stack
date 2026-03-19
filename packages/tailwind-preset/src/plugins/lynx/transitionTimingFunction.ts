// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Plugin } from '../../helpers.js';
import { createTransitionTimingPlugin } from '../../plugin-utils/create-transition-timing-plugin.js';

export const transitionTimingFunction: Plugin = createTransitionTimingPlugin(
  'transition-timing-function',
  'ease',
  'transitionTimingFunction',
);
