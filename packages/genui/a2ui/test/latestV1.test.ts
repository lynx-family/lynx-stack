// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import { defineCatalog } from '../src/catalog/defineCatalog.js';
import type { CatalogFunctionEntry } from '../src/catalog/defineCatalog.js';
import { basicFunctions } from '../src/functions/index.js';
import { accessibilityProps } from '../src/react/accessibility.js';
import { evaluateChecks } from '../src/react/useChecks.js';
import { resolveProperties } from '../src/react/useDataBinding.js';
import { compositionErrors } from '../src/store/composition.js';
import { MessageProcessor } from '../src/store/MessageProcessor.js';
import { resolveDynamicValue } from '../src/store/resolveDynamic.js';
import { executeFunctionCall } from '../src/store/resolveFunctionCall.js';
import { coerceBoolean } from '../src/store/schema.js';
import type { ServerToClientMessage } from '../src/store/types.js';

function setup(functions: CatalogFunctionEntry[] = []) {
  const processor = new MessageProcessor();
  const events: Record<string, unknown>[] = [];
  processor.onEvent(({ message, resolve }) => {
    events.push(message);
    resolve([]);
  });
  processor.registerCatalog(
    'test',
    defineCatalog([...basicFunctions, ...functions]),
  );
  processor.processMessages([{
    version: '1.0',
    createSurface: {
      surfaceId: 's',
      catalogId: 'test',
      dataModel: { name: 'Ada', flag: { valid: false }, n: 7 },
    },
  }]);
  return { processor, events };
}

describe('current official 1.0 contract', () => {
  test.each(['v1.0', 'v0.9', 'v0.9.1', undefined])(
    'rejects earlier wire version %s',
    version => {
      const { processor, events } = setup();
      processor.processMessages(
        [{
          version,
          createSurface: { surfaceId: 'old' },
        }] as unknown as ServerToClientMessage[],
      );
      expect(processor.getSurfaces().has('old')).toBe(false);
      expect(events[0]).toMatchObject({
        version: '1.0',
        error: { code: 'UNSUPPORTED_VERSION' },
      });
    },
  );

  test('plain path/call are data, double-@ escapes once, unknown directives fail', () => {
    const { processor } = setup();
    const resolve = (value: unknown) =>
      resolveDynamicValue(processor, value, 's', undefined, {
        resolveFunctionCall: executeFunctionCall,
      });
    expect(resolve({ '@path': '/name' })).toBe('Ada');
    expect(resolve({ path: '/name', call: 'required' })).toEqual({
      path: '/name',
      call: 'required',
    });
    expect(resolve({ '@@path': '/name', '@@@type': 'x' })).toEqual({
      '@path': '/name',
      '@@type': 'x',
    });
    expect(() => resolve({ '@future': 1 })).toThrow(
      'Unknown dynamic directive',
    );
  });

  test.each([
    [{ valid: false }, false],
    [{ valid: true }, true],
    ['FaLsE', false],
    ['TRUE', true],
    ['hello', false],
    [[], false],
    [{}, false],
    [null, false],
    [0, false],
    [1, true],
  ])('coerces DynamicBoolean %j', (input, expected) => {
    expect(coerceBoolean(input)).toBe(expected);
    const { processor } = setup();
    expect(
      executeFunctionCall(
        processor,
        { '@call': 'not', args: { value: input } },
        's',
      ),
    ).toBe(!expected);
  });

  test('keeps actions and checks unevaluated until their execution boundary', () => {
    let invocations = 0;
    const fn: CatalogFunctionEntry = {
      kind: 'function',
      name: 'act',
      impl: () => ++invocations,
      definition: {
        name: 'act',
        returnType: 'number',
        requiresUserActivation: true,
        parameters: { type: 'object' },
      },
    };
    const { processor, events } = setup([fn]);
    const action = { functionCall: { '@call': 'act' } };
    const checks = [{
      condition: { '@call': 'required', args: { value: { '@path': '/name' } } },
    }];
    const props = resolveProperties(
      { id: 'button', component: 'Button', action, '@checks': checks },
      processor.getOrCreateSurface('s'),
      undefined,
      processor,
    );
    expect(props['action']).toBe(action);
    expect(props['@checks']).toBe(checks);
    expect(invocations).toBe(0);
    expect(executeFunctionCall(processor, { '@call': 'act' }, 's')).toBeNull();
    expect(events[events.length - 1]).toMatchObject({
      error: { code: 'EXPRESSION_ERROR' },
    });
    expect(
      executeFunctionCall(processor, { '@call': 'act' }, 's', undefined, {
        userActivated: true,
      }),
    ).toBe(1);
  });

  test('RPC resolves the specified surface, isolates omitted scope and always responds', async () => {
    const echo: CatalogFunctionEntry = {
      kind: 'function',
      name: 'echo',
      impl: args => args['value'],
      definition: {
        name: 'echo',
        returnType: 'any',
        allowedCallers: 'rendererOrAgent',
        parameters: {
          type: 'object',
          properties: { value: {} },
          required: ['value'],
        },
      },
    };
    const { processor, events } = setup([echo]);
    for (
      const [functionCallId, surfaceId] of [['scoped', 's'], [
        'isolated',
        undefined,
      ], ['missing', 'absent']] as const
    ) {
      processor.processMessages([{
        version: '1.0',
        callRendererFunction: {
          functionCallId,
          ...(surfaceId === undefined ? {} : { surfaceId }),
          callFunction: {
            '@call': 'echo',
            catalogId: 'test',
            args: { value: { '@path': '/n' } },
          },
        },
      }]);
    }
    processor.processMessages([{
      version: '1.0',
      callRendererFunction: {
        functionCallId: 'forbidden',
        callFunction: {
          '@call': 'openUrl',
          catalogId: 'test',
          args: { url: 'https://example.com' },
        },
      },
    }]);
    await Promise.resolve();
    await Promise.resolve();
    expect(events).toEqual(expect.arrayContaining([
      {
        version: '1.0',
        rendererFunctionResponse: { functionCallId: 'scoped', value: 7 },
      },
      {
        version: '1.0',
        rendererFunctionResponse: { functionCallId: 'isolated', value: null },
      },
      expect.objectContaining({
        rendererFunctionResponse: expect.objectContaining({
          functionCallId: 'missing',
          error: expect.objectContaining({
            code: 'INVALID_FUNCTION_CALL',
          }) as unknown,
        }) as unknown,
      }),
      expect.objectContaining({
        rendererFunctionResponse: expect.objectContaining({
          functionCallId: 'forbidden',
          error: expect.objectContaining({
            code: 'INVALID_FUNCTION_CALL',
          }) as unknown,
        }) as unknown,
      }),
    ]));
  });

  test('schema-only functions route to the agent with the resolved catalog and defaults', async () => {
    const { processor, events } = setup([{
      kind: 'function',
      name: 'remote',
      definition: {
        name: 'remote',
        returnType: 'string',
        parameters: {
          type: 'object',
          properties: { count: { type: 'number', default: 3 } },
        },
      },
    }]);
    const pending = executeFunctionCall(
      processor,
      { '@call': 'remote' },
      's',
      undefined,
      { awaitResult: true },
    ) as Promise<unknown>;
    expect(events[0]).toMatchObject({
      callAgentFunction: {
        callFunction: {
          '@call': 'remote',
          catalogId: 'test',
          args: { count: 3 },
        },
      },
    });
    const request = events[0]!['callAgentFunction'] as {
      functionCallId: string;
    };
    processor.processMessages([{
      version: '1.0',
      agentFunctionResponse: {
        functionCallId: request.functionCallId,
        value: 'done',
      },
    }]);
    expect(await pending).toBe('done');
  });

  test('regex enforces the portable dialect, static safety and absolute end anchor', () => {
    const { processor, events } = setup();
    const regex = (pattern: string, value: string) =>
      executeFunctionCall(processor, {
        '@call': 'regex',
        args: { pattern, value },
      }, 's');
    expect(regex('^a$', 'a\n')).toEqual({ valid: false });
    expect(regex('^.$', '😀')).toEqual({ valid: true });
    expect(regex('.*', 'a'.repeat(4097))).toEqual({ valid: false });
    for (
      const pattern of [
        '(a+)+$',
        '(a|ab)*c',
        '\\d+\\s*\\d+',
        '(\\w)\\1',
        '(?<=a)b',
        '\\p{L}',
      ]
    ) {
      expect(regex(pattern, 'a')).toBeNull();
      expect(events[events.length - 1]).toMatchObject({
        error: { code: 'EXPRESSION_ERROR' },
      });
    }
  });
});

test('qualified interpolation stays in its enclosing catalog and never routes missing functions', () => {
  const { processor, events } = setup();
  processor.registerCatalog(
    'formatters',
    defineCatalog([...basicFunctions, {
      kind: 'function',
      name: 'label',
      impl: () => 'qualified',
    }]),
  );
  expect(executeFunctionCall(processor, {
    '@call': 'formatString',
    catalogId: 'formatters',
    args: { value: '${label()}' },
  }, 's')).toBe('qualified');
  expect(executeFunctionCall(processor, {
    '@call': 'formatString',
    catalogId: 'formatters',
    args: { value: '${missing()}' },
  }, 's')).toBeNull();
  expect(events.some(event => 'callAgentFunction' in event)).toBe(false);
  expect(events[events.length - 1]).toMatchObject({
    error: { code: 'EXPRESSION_ERROR' },
  });
});

test('imperative calls await nested async arguments and issue fresh invocations', async () => {
  let invocations = 0;
  const { processor } = setup([
    { kind: 'function', name: 'asyncValue', impl: async () => ++invocations },
    {
      kind: 'function',
      name: 'double',
      impl: args => Number(args['value']) * 2,
    },
  ]);
  const call = {
    '@call': 'double',
    args: { value: { '@call': 'asyncValue' } },
  };
  expect(
    await executeFunctionCall(processor, call, 's', undefined, {
      awaitResult: true,
    }),
  ).toBe(2);
  expect(
    await executeFunctionCall(processor, call, 's', undefined, {
      awaitResult: true,
    }),
  ).toBe(4);
});

test('transport failures end RPCs and report the failed call ID without a surface ID', async () => {
  const { processor, events } = setup();
  processor.onEvent(({ message, resolve, reject }) => {
    if ('callAgentFunction' in message) reject(new Error('offline'));
    else resolve([]);
  });
  await expect(
    executeFunctionCall(processor, { '@call': 'remote' }, 's', undefined, {
      awaitResult: true,
    }),
  ).rejects.toThrow('offline');
  const call = events.find(event =>
    'callAgentFunction' in event
  )!['callAgentFunction'] as { functionCallId: string };
  const error = events[events.length - 1]!['error'] as Record<string, unknown>;
  expect(error).toMatchObject({
    code: 'EXPRESSION_ERROR',
    functionCallId: call.functionCallId,
  });
  expect(error).not.toHaveProperty('surfaceId');
});

test('accessibility bindings use the current envelope and boolean coercion', () => {
  const { processor } = setup();
  const props = resolveProperties(
    {
      '@accessibility': {
        label: { '@path': '/name' },
        description: 'Profile',
        hidden: { '@path': '/flag' },
        live: 'polite',
      },
    },
    processor.getOrCreateSurface('s'),
    undefined,
    processor,
  )!;
  expect(accessibilityProps(props)).toMatchObject({
    'accessibility-label': 'Ada. Profile',
    'aria-label': 'Ada',
    'aria-description': 'Profile',
    'aria-hidden': false,
    'accessibility-elements-hidden': false,
    'aria-live': 'polite',
  });
});

test('composition constraints include the implicit Surface and schema-defined child slots', () => {
  const catalog = defineCatalog([
    {
      name: 'Container',
      component: () => null,
      schema: {
        type: 'object',
        allowedParents: ['Surface'],
        allowedChildren: ['Label'],
        properties: { child: { $ref: 'common_types.json#/$defs/ComponentId' } },
      },
    },
    {
      name: 'Label',
      component: () => null,
      schema: { type: 'object', allowedParents: ['Container'] },
    },
  ]);
  expect(compositionErrors(
    new Map([
      ['root', { id: 'root', component: 'Container', child: 'text' }],
      ['text', { id: 'text', component: 'Label' }],
    ]),
    'test',
    () => catalog,
  )).toEqual([]);
  expect(
    compositionErrors(
      new Map([['root', { id: 'root', component: 'Label' }]]),
      'test',
      () => catalog,
    ),
  )
    .toMatchObject([{ code: 'UNALLOWED_PARENT' }]);
  expect(() => defineCatalog([{ name: 'Surface', component: () => null }]))
    .toThrow('reserved');
});

test('a failed remote check preserves the agent error message without a fallback', async () => {
  const { processor, events } = setup();
  const surface = processor.getOrCreateSurface('s');
  const checks = [{ condition: { '@call': 'verify' } }];
  expect(evaluateChecks(processor, checks, surface).ok).toBe(false);
  const request = events[0]!['callAgentFunction'] as { functionCallId: string };
  processor.processMessages([{
    version: '1.0',
    agentFunctionResponse: {
      functionCallId: request.functionCallId,
      error: { code: 'INVALID_FUNCTION_CALL', message: 'Provider unavailable' },
    },
  }]);
  await Promise.resolve();
  expect(evaluateChecks(processor, checks, surface)).toMatchObject({
    ok: false,
    failures: [{ message: 'Provider unavailable', severity: 'error' }],
  });
});
