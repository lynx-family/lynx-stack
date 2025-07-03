// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it } from 'vitest';

import { getMock, runPlugin } from './utils/run-plugin.js';
import * as plugins from '../plugins/lynx/index.js';

describe('Lynx plugin coverage sanity check', () => {
  for (const [name, plugin] of Object.entries(plugins)) {
    it(`${name} registers utilities`, () => {
      const { api } = runPlugin(plugin);

      const matchUtilities = getMock(api.matchUtilities);
      const addUtilities = getMock(api.addUtilities);
      const addComponents = getMock(api.addComponents);
      const addBase = getMock(api.addBase);

      const called = matchUtilities.mock.calls.length > 0
        || addUtilities.mock.calls.length > 0
        || addComponents.mock.calls.length > 0
        || addBase.mock.calls.length > 0;

      expect(called).toBe(true);
    });
  }
});
