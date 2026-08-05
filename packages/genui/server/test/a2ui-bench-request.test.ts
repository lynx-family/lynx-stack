// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import { normalizeBenchJobRequest } from '../service/a2ui-bench-request.js';

const group = {
  id: 'control',
  role: 'control',
  name: 'Control',
  variable: 'model',
  enabled: true,
};

const scenario = {
  id: 'hangzhou',
  name: 'Hangzhou itinerary',
  prompt: 'Create a five-day Hangzhou itinerary.',
  type: 'Travel',
};

describe('bench group protocols', () => {
  test('keeps old groups on the A2UI protocol', () => {
    const result = normalizeBenchJobRequest(
      {
        groups: [group],
        scenarios: [scenario],
        settings: {
          protocols: ['a2ui', 'lynx-xml'],
          repeats: 2,
        },
      },
      { clientOverrideAccepted: false },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.groups[0]?.protocol).toBe('a2ui');
    expect(result.totalRuns).toBe(2);
  });

  test('keeps the protocol on each group without multiplying the matrix', () => {
    const result = normalizeBenchJobRequest(
      {
        groups: [
          { ...group, protocol: 'a2ui' },
          {
            ...group,
            id: 'openui',
            role: 'experiment',
            name: 'OpenUI',
            protocol: 'openui',
          },
          {
            ...group,
            id: 'lynx-xml',
            role: 'experiment',
            name: 'Lynx XML',
            protocol: 'lynx-xml',
          },
        ],
        scenarios: [scenario],
        settings: { repeats: 3 },
      },
      { clientOverrideAccepted: false },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.groups.map((item) => item.protocol)).toEqual([
      'a2ui',
      'openui',
      'lynx-xml',
    ]);
    expect(result.totalRuns).toBe(9);
  });

  test('falls back to A2UI for an unsupported group protocol', () => {
    const result = normalizeBenchJobRequest(
      {
        groups: [{ ...group, protocol: 'unsupported' }],
        scenarios: [scenario],
      },
      { clientOverrideAccepted: false },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.groups[0]?.protocol).toBe('a2ui');
  });
});
