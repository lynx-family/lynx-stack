// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { beforeEach, describe, expect, test } from '@rstest/core';

import { basicFunctions } from '../src/functions/index.js';
import { functionRegistry } from '../src/store/FunctionRegistry.js';
import { MessageProcessor } from '../src/store/MessageProcessor.js';
import { executeFunctionCall } from '../src/store/resolveFunctionCall.js';

describe('executeFunctionCall', () => {
  const surfaceId = 'execTestSurface';
  let processor: MessageProcessor;

  void beforeEach(() => {
    processor = new MessageProcessor();
    processor.registerCatalog('test', {
      components: [],
      functions: [
        ...basicFunctions,
        { kind: 'function', name: 'identity', impl: args => args['value'] },
      ],
    });
    processor.processMessages([{
      version: 'v1.0',
      createSurface: { surfaceId, catalogId: 'test' },
    }]);
  });

  test('routes by name and returns the impl result', () => {
    expect(executeFunctionCall(
      processor,
      { call: 'identity', args: { value: 'hi' } },
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
      },
      surfaceId,
    )).toBe(15);
  });

  test('does not fall back to globally registered functions outside the surface catalog', () => {
    functionRegistry.register({
      name: 'globalOnly',
      impl: () => 'wrong catalog',
    });
    expect(
      executeFunctionCall(processor, {
        call: 'globalOnly',
        catalogId: 'missing',
      }, surfaceId),
    ).toBeUndefined();
    functionRegistry.unregister('globalOnly');
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
              call: 'not_equals',
              args: { a: { path: '/email' }, b: '' },
            },
            {
              call: 'equals',
              args: { a: { path: '/password' }, b: 'long-password' },
            },
          ],
        },
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
              call: 'not_equals',
              args: { a: { path: '/email' }, b: '' },
            },
            {
              call: 'equals',
              args: { a: { path: '/password' }, b: 'long-password' },
            },
          ],
        },
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
      },
      surfaceId,
      undefined,
      { functions: basicFunctions },
    )).toBe('Hello Ada');
  });
});
