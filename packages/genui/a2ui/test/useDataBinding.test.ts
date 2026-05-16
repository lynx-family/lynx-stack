// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import { resolveProperties } from '../src/react/useDataBinding.js';
import { SignalStore } from '../src/store/SignalStore.js';
import type { Surface } from '../src/store/types.js';

function createSurface(): Surface {
  return {
    surfaceId: 'surface-1',
    components: new Map(),
    resources: new Map(),
    store: new SignalStore(),
  };
}

describe('resolveProperties', () => {
  test('resolves path bindings and keeps primitive values', () => {
    const surface = createSurface();
    surface.store.update('/weather/tempLow', 12);

    const resolved = resolveProperties(
      {
        title: 'hello',
        visible: true,
        tempLow: { path: 'weather/tempLow' },
      },
      surface,
    );

    expect(resolved).toEqual({
      title: 'hello',
      visible: true,
      tempLow: 12,
    });
  });

  test('returns Unsupported Data Syntax for call expressions', () => {
    const surface = createSurface();

    const resolved = resolveProperties(
      {
        text: {
          call: 'formatString',
          args: {
            value: '${/tempLow}°',
          },
          returnType: 'string',
        },
      },
      surface,
    );

    expect(typeof resolved['text']).toBe('symbol');
  });
});
