// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import { applyA2UIMessagesToSnapshot } from './useConversation.js';

describe('A2UI conversation snapshots', () => {
  test('applies an inline v1.0 data model and null deletion', () => {
    const dataModel: Record<string, unknown> = { stale: true };
    const surfaceIds = new Set<string>();

    applyA2UIMessagesToSnapshot(dataModel, surfaceIds, [
      {
        version: 'v1.0',
        createSurface: {
          surfaceId: 'main',
          dataModel: { title: 'Hello' },
        },
      },
      {
        version: 'v1.0',
        updateDataModel: {
          surfaceId: 'main',
          path: '/title',
          value: null,
        },
      },
    ]);

    expect(surfaceIds).toEqual(new Set(['main']));
    expect(dataModel).toEqual({});
  });

  test('preserves an explicit v0.9 null value', () => {
    const dataModel: Record<string, unknown> = { title: 'Hello' };

    applyA2UIMessagesToSnapshot(dataModel, new Set(['main']), [
      {
        version: 'v0.9',
        updateDataModel: {
          surfaceId: 'main',
          path: '/title',
          value: null,
        },
      },
    ]);

    expect(dataModel).toEqual({ title: null });
  });
});
