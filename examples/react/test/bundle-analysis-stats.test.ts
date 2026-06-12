// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from 'vitest';

import { getLynxBundleStatsJson } from '../../bundle-analysis-stats.plugin.js';

describe('bundle analysis stats plugin', () => {
  test('selects the lynx child from multi-compiler stats output', () => {
    const webStats = {
      name: 'web',
      assets: ['web.js'],
      chunks: ['web'],
      modules: ['web-module'],
      entrypoints: { main: {} },
      namedChunkGroups: { main: {} },
    };
    const lynxStats = {
      name: 'lynx',
      assets: ['main.lynx.bundle'],
      chunks: ['lynx'],
      modules: ['lynx-module'],
      entrypoints: { main: {} },
      namedChunkGroups: { main: {} },
    };

    expect(getLynxBundleStatsJson({
      children: [webStats, lynxStats],
    })).toBe(lynxStats);
  });
});
