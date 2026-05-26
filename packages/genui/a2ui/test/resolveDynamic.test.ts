// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { beforeEach, describe, expect, test } from '@rstest/core';

import type { CatalogFunctionEntry } from '../src/catalog/defineCatalog.js';
import { MessageProcessor } from '../src/store/MessageProcessor.js';
import {
  resolveBindingPath,
  resolveDynamicValue,
} from '../src/store/resolveDynamic.js';
import { executeFunctionCall } from '../src/store/resolveFunctionCall.js';

describe('resolveDynamic', () => {
  const surfaceId = 'resolveDynamicSurface';
  let processor: MessageProcessor;
  const functions: readonly CatalogFunctionEntry[] = [
    {
      kind: 'function',
      name: 'identity',
      impl: args => args['value'],
    },
    {
      kind: 'function',
      name: 'add',
      impl: args => Number(args['a']) + Number(args['b']),
    },
  ];

  void beforeEach(() => {
    processor = new MessageProcessor();
  });

  test('resolves binding paths relative to the current data context', () => {
    expect(resolveBindingPath('temperature', '/weather')).toBe(
      '/weather/temperature',
    );
    expect(resolveBindingPath('/weather/temperature', '/ignored')).toBe(
      '/weather/temperature',
    );
    expect(resolveBindingPath('temperature')).toBe('/temperature');
  });

  test('resolves plain data bindings from the surface store', () => {
    const surface = processor.getOrCreateSurface(surfaceId);
    surface.store.update('/weather/tempLow', '12');

    expect(
      resolveDynamicValue(
        processor,
        { path: 'tempLow' },
        surfaceId,
        '/weather',
      ),
    ).toBe(12);
  });

  test('evaluates nested function calls when functions are provided', () => {
    expect(
      resolveDynamicValue(
        processor,
        {
          call: 'add',
          args: { a: 1, b: { call: 'identity', args: { value: 2 } } },
          returnType: 'number',
        },
        surfaceId,
        undefined,
        {
          functions,
          resolveFunctionCall: executeFunctionCall,
        },
      ),
    ).toBe(3);
  });

  test('leaves nested function calls untouched when functions are not provided', () => {
    expect(
      resolveDynamicValue(
        processor,
        {
          call: 'add',
          args: { a: 1, b: { call: 'identity', args: { value: 2 } } },
          returnType: 'number',
        },
        surfaceId,
      ),
    ).toEqual({
      call: 'add',
      args: { a: 1, b: { call: 'identity', args: { value: 2 } } },
      returnType: 'number',
    });
  });
});
