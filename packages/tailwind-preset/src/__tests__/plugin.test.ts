// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it, rstest } from '@rstest/core';

import { runPlugin } from './utils/run-plugin.js';
import * as lynxPlugins from '../plugins/lynx/index.js';

it('resolves plugin object with handler', () => {
  const handler = rstest.fn();
  const plugin = { handler };
  runPlugin(plugin);
  expect(handler).toHaveBeenCalledWith(expect.any(Object));
});

describe('Lynx plugin coverage sanity check', () => {
  for (const [name, plugin] of Object.entries(lynxPlugins)) {
    it(`${name} registers utilities`, () => {
      const { api } = runPlugin(plugin);

      const matchUtilities = rstest.mocked(api.matchUtilities);
      const addUtilities = rstest.mocked(api.addUtilities);
      const addComponents = rstest.mocked(api.addComponents);
      const addBase = rstest.mocked(api.addBase);
      const matchVariant = rstest.mocked(api.matchVariant);
      const matchComponents = rstest.mocked(api.matchComponents);

      const called = matchUtilities.mock.calls.length > 0
        || addUtilities.mock.calls.length > 0
        || addComponents.mock.calls.length > 0
        || addBase.mock.calls.length > 0
        || matchVariant.mock.calls.length > 0
        || matchComponents.mock.calls.length > 0;

      expect(called).toBe(true);
    });
  }
});
