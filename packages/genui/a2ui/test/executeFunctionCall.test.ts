// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { beforeEach, describe, expect, test } from '@rstest/core';

import { basicFunctions } from '../src/functions/index.js';
import { functionRegistry } from '../src/store/FunctionRegistry.js';
import { MessageProcessor } from '../src/store/MessageProcessor.js';
import {
  executeFunctionCall,
  resolveDynamicValue,
} from '../src/store/resolveFunctionCall.js';

describe('executeFunctionCall', () => {
  const surfaceId = 'execTestSurface';
  let processor: MessageProcessor;

  void beforeEach(() => {
    processor = new MessageProcessor();
    functionRegistry.register({
      name: 'identity',
      impl: (args) => args['value'],
    });
    functionRegistry.register({
      name: 'add',
      impl: (args) => Number(args['a']) + Number(args['b']),
    });
  });

  test('routes by name and returns the impl result', () => {
    expect(executeFunctionCall(
      processor,
      { call: 'identity', args: { value: 'hi' }, returnType: 'string' },
      surfaceId,
    )).toBe('hi');
  });

  test('resolves data-binding args against the surface store', () => {
    const surface = processor.getOrCreateSurface(surfaceId);
    surface.store.update('/a', '7');
    surface.store.update('/b', '8');
    expect(executeFunctionCall(
      processor,
      {
        call: 'add',
        args: { a: { path: '/a' }, b: { path: '/b' } },
        returnType: 'number',
      },
      surfaceId,
    )).toBe(15);
  });

  test('returns undefined and warns once for unknown functions', () => {
    const captured: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      captured.push(args.map(String).join(' '));
    };

    try {
      expect(executeFunctionCall(
        processor,
        { call: 'doesNotExist', args: {}, returnType: 'any' },
        surfaceId,
      )).toBeUndefined();
      // Second call should not duplicate the warning.
      executeFunctionCall(
        processor,
        { call: 'doesNotExist', args: {}, returnType: 'any' },
        surfaceId,
      );
      expect(
        captured.filter(line => line.includes('doesNotExist')).length,
      ).toBe(1);
    } finally {
      console.warn = originalWarn;
    }
  });

  test('resolveDynamicValue evaluates nested function calls', () => {
    expect(resolveDynamicValue(
      processor,
      {
        call: 'add',
        args: { a: 1, b: { call: 'identity', args: { value: 2 } } },
        returnType: 'number',
      },
      surfaceId,
    )).toBe(3);
  });

  test('resolves array args without turning them into objects', () => {
    const surface = processor.getOrCreateSurface(surfaceId);
    surface.store.update('/email', '');
    surface.store.update('/password', 'long-password');

    expect(executeFunctionCall(
      processor,
      {
        call: 'and',
        args: {
          values: [
            {
              call: 'required',
              args: { value: { path: '/email' } },
              returnType: 'boolean',
            },
            {
              call: 'length',
              args: { value: { path: '/password' }, min: 8 },
              returnType: 'boolean',
            },
          ],
        },
        returnType: 'boolean',
      },
      surfaceId,
      undefined,
      { functions: basicFunctions },
    )).toBe(false);

    surface.store.update('/email', 'ada@example.com');

    expect(executeFunctionCall(
      processor,
      {
        call: 'and',
        args: {
          values: [
            {
              call: 'required',
              args: { value: { path: '/email' } },
              returnType: 'boolean',
            },
            {
              call: 'length',
              args: { value: { path: '/password' }, min: 8 },
              returnType: 'boolean',
            },
          ],
        },
        returnType: 'boolean',
      },
      surfaceId,
      undefined,
      { functions: basicFunctions },
    )).toBe(true);
  });

  test('basic functions use upstream zod parsing and data context', () => {
    const surface = processor.getOrCreateSurface(surfaceId);
    surface.store.update('/name', 'Ada');

    expect(executeFunctionCall(
      processor,
      {
        call: 'add',
        args: { a: '7', b: '8' },
        returnType: 'number',
      },
      surfaceId,
      undefined,
      { functions: basicFunctions },
    )).toBe(15);

    expect(executeFunctionCall(
      processor,
      {
        call: 'formatString',
        args: { value: 'Hello ${/name}' },
        returnType: 'string',
      },
      surfaceId,
      undefined,
      { functions: basicFunctions },
    )).toBe('Hello Ada');
  });
});
