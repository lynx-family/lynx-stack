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

  test('resolves nested bindings inside arrays and objects', () => {
    const surface = createSurface();
    surface.store.update('/weather/dates', [
      'Oct 1',
      'Oct 2',
      'Oct 3',
    ]);
    surface.store.update('/weather/temperatures', [22, 24, 23]);
    surface.store.update('/weather/precipitations', [0, 5, 0]);

    const resolved = resolveProperties(
      {
        labels: { path: '/weather/dates' },
        series: [
          {
            name: 'Temperature',
            values: { path: '/weather/temperatures' },
            color: '#FF5733',
          },
          {
            name: 'Precipitation',
            values: { path: '/weather/precipitations' },
            color: '#33A1FF',
          },
        ],
        variant: 'linear',
        xLabel: 'Date',
        yLabel: 'Value',
        showGrid: true,
        showLegend: true,
        height: 300,
      },
      surface,
    );

    expect(resolved).toMatchObject({
      labels: ['Oct 1', 'Oct 2', 'Oct 3'],
      series: [
        {
          name: 'Temperature',
          values: [22, 24, 23],
          color: '#FF5733',
        },
        {
          name: 'Precipitation',
          values: [0, 5, 0],
          color: '#33A1FF',
        },
      ],
      variant: 'linear',
      xLabel: 'Date',
      yLabel: 'Value',
      showGrid: true,
      showLegend: true,
      height: 300,
    });
  });

  test('reuses the previous resolved snapshot when values do not change', () => {
    const surface = createSurface();
    surface.store.update('/weather/dates', ['Mon', 'Tue']);
    surface.store.update('/weather/temperatures', [12, 14]);

    const props = {
      labels: { path: '/weather/dates' },
      series: [
        {
          name: 'Temperature',
          values: { path: '/weather/temperatures' },
        },
      ],
    };

    const first = resolveProperties(props, surface);
    const second = resolveProperties(
      props,
      surface,
      undefined,
      undefined,
      undefined,
      first,
    );

    expect(second).toBe(first);
    expect(second['series']).toBe(first['series']);
  });
});
