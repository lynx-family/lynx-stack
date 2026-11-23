// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import { act, renderHook } from '@lynx-js/react/testing-library';

import { basicFunctions } from '../src/functions/index.js';
import {
  resolveProperties,
  useResolvedProps,
} from '../src/react/useDataBinding.js';
import { MessageProcessor } from '../src/store/MessageProcessor.js';
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
  test.each([
    {
      component: 'RadioGroup',
      key: 'items',
      call: 'choices',
      initial: ['A', 'B'],
      updated: ['A'],
    },
    {
      component: 'CustomField',
      key: 'validation',
      call: 'required',
      initial: { valid: true },
      updated: { valid: false },
    },
    {
      component: 'CustomField',
      key: 'details',
      call: 'details',
      initial: { rows: [{ '@path': 'B' }] },
      updated: { rows: [] },
    },
  ])(
    'reuses the snapshot for $component with a synchronous $call result',
    async ({
      component,
      key,
      call,
      initial,
      updated,
    }) => {
      const processor = new MessageProcessor();
      const surface = processor.getOrCreateSurface('s');
      surface.catalogId = 'test';
      processor.registerCatalog('test', {
        components: [{
          name: 'RadioGroup',
          component: () => null,
          schema: {
            properties: {
              items: {
                oneOf: [{ type: 'array', items: { type: 'string' } }, {
                  type: 'object',
                }],
              },
            },
          },
        }, { name: 'CustomField', component: () => null }],
        functions: [
          ...basicFunctions,
          {
            kind: 'function',
            name: 'choices',
            impl: args => args['value'] ? ['A', 'B'] : ['A'],
          },
          {
            kind: 'function',
            name: 'details',
            impl: args => ({
              rows: args['value'] ? [{ '@path': args['value'] }] : [],
            }),
          },
        ],
      });
      const props = {
        component,
        [key]: { '@call': call, args: { value: { '@path': '/input' } } },
      };
      const read = (previous?: Record<string, unknown>) =>
        resolveProperties(
          props,
          surface,
          undefined,
          processor,
          undefined,
          previous,
        );

      surface.store.update('/input', 'B');
      const first = read();
      expect(first[key]).toEqual(initial);
      expect(read(first)).toBe(first);

      const view = renderHook(() =>
        useResolvedProps(props, surface, undefined, processor)[0]
      );
      try {
        const mounted = view.result.current;
        expect(mounted[key]).toEqual(initial);
        await act(() => surface.store.update('/input', ''));
        const next = view.result.current;
        expect(next[key]).toEqual(updated);
        expect(mounted[key]).toEqual(initial);
        expect(read(next)).toBe(next);
      } finally {
        view.unmount();
      }
    },
  );

  test.each(['literal', 'binding'])(
    'keeps a stable snapshot for a schema-coerced %s object array',
    source => {
      const surface = createSurface();
      surface.catalogId = 'test';
      const processor = new MessageProcessor();
      processor.registerCatalog('test', {
        functions: [],
        components: [{
          name: 'Chart',
          component: () => null,
          schema: {
            properties: {
              points: {
                type: 'array',
                items: { properties: { x: { $ref: '#/$defs/DynamicNumber' } } },
              },
            },
          },
        }],
      });

      let points = [{ x: '1' }, { x: '2' }];
      const read = (previous?: Record<string, unknown>) =>
        resolveProperties(
          {
            component: 'Chart',
            points: source === 'literal' ? points : { '@path': '/points' },
          },
          surface,
          undefined,
          processor,
          undefined,
          previous,
        );
      surface.store.update('/points', points);
      const first = read();
      expect(first['points']).toEqual([{ x: 1 }, { x: 2 }]);
      expect(read(first)).toBe(first);

      points = [{ x: '1' }, { x: '3' }];
      surface.store.update('/points', points);
      const updated = read(first);
      expect(updated['points']).toEqual([{ x: 1 }, { x: 3 }]);
      expect(first['points']).toEqual([{ x: 1 }, { x: 2 }]);
      expect(read(updated)).toBe(updated);

      points = [];
      surface.store.update('/points', points);
      const empty = read(updated);
      expect(empty['points']).toEqual([]);
      expect(read(empty)).toBe(empty);
    },
  );

  test('resolves path bindings and keeps primitive values', () => {
    const surface = createSurface();
    surface.store.update('/weather/tempLow', 12);

    const resolved = resolveProperties(
      {
        title: 'hello',
        visible: true,
        tempLow: { '@path': 'weather/tempLow' },
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
          '@call': 'formatString',
          args: {
            value: '${/tempLow}°',
          },
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
        labels: { '@path': '/weather/dates' },
        series: [
          {
            name: 'Temperature',
            values: { '@path': '/weather/temperatures' },
            color: '#FF5733',
          },
          {
            name: 'Precipitation',
            values: { '@path': '/weather/precipitations' },
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
      labels: { '@path': '/weather/dates' },
      series: [
        {
          name: 'Temperature',
          values: { '@path': '/weather/temperatures' },
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
