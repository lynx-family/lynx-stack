// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import { evaluateChecks } from '../src/react/useChecks.js';
import { compactA2UIMessagesToSnapshot } from '../src/snapshot/index.js';
import { MessageProcessor } from '../src/store/MessageProcessor.js';
import { normalizePayloadToMessages } from '../src/store/payloadNormalizer.js';
import { resolveDynamicValue } from '../src/store/resolveDynamic.js';
import { executeFunctionCall } from '../src/store/resolveFunctionCall.js';
import type { ServerToClientMessage } from '../src/store/types.js';

const initial: ServerToClientMessage = {
  version: 'v1.0',
  createSurface: {
    surfaceId: 's',
    catalogId: 'test',
    sendDataModel: true,
    components: [
      {
        id: 'root',
        component: 'Column',
        children: { path: '/items', componentId: 'row' },
      },
      { id: 'row', component: 'Text', text: { path: 'label' } },
    ],
    dataModel: {
      items: [{ label: '007' }, { label: 'false' }],
      user: { name: 'Alice', stale: true },
    },
  },
};

describe('A2UI v1.0', () => {
  test.each(['v0.9', 'v0.9.1', 'v1.1', 'v2.0', undefined])(
    'rejects unsupported version %s without mutating surfaces',
    (version) => {
      const processor = new MessageProcessor();
      const messages = [{
        version,
        createSurface: {
          surfaceId: 'old',
          components: [{ id: 'root', component: 'Text', text: 'old' }],
        },
      }] as unknown as ServerToClientMessage[];
      const events: unknown[] = [];
      processor.onEvent(({ message, resolve }) => {
        events.push(message);
        resolve([]);
      });
      processor.processMessages(messages);
      expect(processor.getSurfaces().size).toBe(0);
      expect(events).toMatchObject([{
        version: 'v1.0',
        error: { code: 'VALIDATION_FAILED' },
      }]);
      expect(() => compactA2UIMessagesToSnapshot(messages)).toThrow(
        'Only A2UI v1.0 is supported',
      );
    },
  );
  test.each(['false', 1, undefined])(
    'rejects malformed ValidationResult.valid %s',
    (valid) => {
      const processor = new MessageProcessor();
      processor.processMessages([initial]);
      const surface = processor.getOrCreateSurface('s');
      surface.store.update('/validation', { valid });
      expect(
        evaluateChecks(
          processor,
          [{ condition: { path: '/validation' } }],
          surface,
        ).ok,
      ).toBe(false);
    },
  );

  test('renders inline initialization, expands templates and preserves JSON scalar types', () => {
    const processor = new MessageProcessor();
    processor.processMessages([initial]);
    const surface = processor.getOrCreateSurface('s');
    expect(surface.components.get('root')?.['children']).toEqual([
      'row:0',
      'row:1',
    ]);
    expect(surface.components.get('row:0')?.dataContextPath).toBe('/items/0');
    expect(resolveDynamicValue(processor, { path: 'label' }, 's', '/items/0'))
      .toBe('007');
    expect(resolveDynamicValue(processor, { path: 'label' }, 's', '/items/1'))
      .toBe('false');
    expect(
      executeFunctionCall(
        processor,
        { call: '@index', args: { offset: 1 } },
        's',
        '/items/1',
      ),
    ).toBe(2);
    expect(executeFunctionCall(processor, { call: '@index' }, 's'))
      .toBeUndefined();
  });

  test('replaces subtrees, deletes null paths, updates ancestors and snapshots local inputs', () => {
    const processor = new MessageProcessor();
    processor.processMessages([initial]);
    const store = processor.getOrCreateSurface('s').store;
    const stale = store.getSignal('/user/stale');
    processor.processMessages([{
      version: 'v1.0',
      updateDataModel: {
        surfaceId: 's',
        path: '/user',
        value: { name: 'Bob' },
      },
    }]);
    expect(stale.value).toBeUndefined();
    store.update('/user/name', 'Carol');
    expect(store.getSignal('/user').value).toEqual({ name: 'Carol' });
    processor.processMessages([{
      version: 'v1.0',
      updateDataModel: { surfaceId: 's', path: '/items/0', value: null },
    }]);
    expect(store.getSignal('/items').value).toEqual([{ label: 'false' }]);
    expect(
      processor.getOrCreateSurface('s').components.get('root')?.['children'],
    ).toEqual(['row:0']);
    expect(processor.getDataModelMetadata()).toEqual({
      a2uiRendererDataModel: {
        version: 'v1.0',
        surfaces: {
          s: { items: [{ label: 'false' }], user: { name: 'Carol' } },
        },
      },
    });
    processor.processMessages([{
      version: 'v1.0',
      updateDataModel: { surfaceId: 's', value: { 'a/b': { '~key': false } } },
    }]);
    expect(store.getSignal('/user/name').value).toBeUndefined();
    expect(store.getSignal('/a~1b/~0key').value).toBe(false);
  });

  test('expands templates when data arrives before components and waits for root', () => {
    const processor = new MessageProcessor();
    processor.processMessages([
      {
        version: 'v1.0',
        createSurface: {
          surfaceId: 's',
          catalogId: 'test',
          dataModel: { items: [{ label: 'first' }] },
        },
      },
      {
        version: 'v1.0',
        updateComponents: {
          surfaceId: 's',
          components: [{
            id: 'row',
            component: 'Text',
            text: { path: 'label' },
          }],
        },
      },
    ]);
    expect(processor.getOrCreateSurface('s').rootComponentId).toBeNull();
    processor.processMessages([{
      version: 'v1.0',
      updateComponents: {
        surfaceId: 's',
        components: [{
          id: 'root',
          component: 'Column',
          children: { path: '/items', componentId: 'row' },
        }],
      },
    }]);
    expect(
      processor.getOrCreateSurface('s').components.get('root')?.['children'],
    ).toEqual(['row:0']);
  });

  test('compaction retains the version, inline state and deletion semantics', () => {
    const messages: ServerToClientMessage[] = [initial, {
      version: 'v1.0',
      updateDataModel: { surfaceId: 's', path: '/items/0', value: null },
    }];
    const compact = compactA2UIMessagesToSnapshot(messages);
    expect(compact.messages.every(message => message.version === 'v1.0')).toBe(
      true,
    );
    const processor = new MessageProcessor();
    processor.processMessages(compact.messages);
    expect(
      processor.getOrCreateSurface('s').store.getSignal('/items/0/label').value,
    ).toBe('false');
    expect(JSON.stringify(compact.messages)).not.toContain('007');
  });

  test('remote calls require catalog permission and always produce a correlated response', async () => {
    const processor = new MessageProcessor();
    const events: Record<string, unknown>[] = [];
    processor.onEvent(({ message, resolve }) => {
      events.push(message);
      resolve([]);
    });
    processor.registerCatalog('test', {
      components: [],
      functions: [
        {
          kind: 'function',
          name: 'local',
          impl: () => {
            throw new Error('must not execute');
          },
        },
        {
          kind: 'function',
          name: 'remote',
          impl: args => args['value'],
          definition: {
            name: 'remote',
            parameters: {},
            returnType: 'any',
            allowedCallers: 'rendererOrAgent',
          },
        },
      ],
    });
    processor.processMessages(
      normalizePayloadToMessages({
        version: 'v1.0',
        callRendererFunction: {
          functionCallId: 'denied',
          callFunction: { catalogId: 'test', call: 'local' },
        },
      }),
    );
    processor.processMessages([{
      version: 'v1.0',
      callRendererFunction: {
        functionCallId: 'allowed',
        callFunction: {
          catalogId: 'test',
          call: 'remote',
          args: { value: false },
        },
      },
    }]);
    await Promise.resolve();
    expect(events).toContainEqual({
      version: 'v1.0',
      error: {
        code: 'INVALID_FUNCTION_CALL',
        message: 'Function "local" is not callable by the agent',
        functionCallId: 'denied',
      },
    });
    expect(events).toContainEqual({
      version: 'v1.0',
      rendererFunctionResponse: { functionCallId: 'allowed', value: false },
    });
  });

  test('structured validation results fail checks and use their own messages', () => {
    const processor = new MessageProcessor();
    processor.processMessages([initial, {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: 's',
        path: '/validation',
        value: { valid: false, message: 'Expired card' },
      },
    }]);
    const surface = processor.getOrCreateSurface('s');
    expect(
      evaluateChecks(
        processor,
        [{ condition: { path: '/validation' } }],
        surface,
      ),
    ).toEqual({
      ok: false,
      failures: [{ call: 'condition', message: 'Expired card' }],
    });
    surface.store.update('/validation', { valid: true });
    expect(
      evaluateChecks(
        processor,
        [{ condition: { path: '/validation' } }],
        surface,
      ).ok,
    ).toBe(true);
  });

  test('duplicate inline creation cannot overwrite an existing surface', () => {
    const processor = new MessageProcessor();
    processor.processMessages([initial, {
      version: 'v1.0',
      createSurface: { surfaceId: 's', dataModel: { overwritten: true } },
    }]);
    expect(
      processor.getOrCreateSurface('s').store.getSignal('/overwritten').value,
    ).toBeUndefined();
  });

  test('async dynamic calls share one pending result and become reactive values', async () => {
    const processor = new MessageProcessor();
    processor.registerCatalog('test', { components: [], functions: [] });
    processor.processMessages([initial]);
    const ids: string[] = [];
    processor.onEvent(({ message, resolve }) => {
      ids.push(
        (message['callAgentFunction'] as { functionCallId: string })
          .functionCallId,
      );
      resolve([]);
    });
    const call = { call: 'lookup' };
    expect(executeFunctionCall(processor, call, 's')).toBeUndefined();
    expect(executeFunctionCall(processor, call, 's')).toBeUndefined();
    expect(ids).toHaveLength(1);
    processor.processMessages([{
      version: 'v1.0',
      agentFunctionResponse: { functionCallId: ids[0]!, value: 'ready' },
    }]);
    await Promise.resolve();
    expect(executeFunctionCall(processor, call, 's')).toBe('ready');
    expect(ids).toHaveLength(1);
  });

  test('correlates concurrent agent responses and rejects execution errors', async () => {
    const processor = new MessageProcessor();
    const requests: string[] = [];
    processor.onEvent(({ message, resolve }) => {
      requests.push(
        (message['callAgentFunction'] as { functionCallId: string })
          .functionCallId,
      );
      resolve([]);
    });
    const first = processor.callAgentFunction('s', { call: 'first' });
    const second = processor.callAgentFunction('s', { call: 'second' });
    const rejected = expect(second).rejects.toThrow('Unknown function');
    processor.processMessages([
      {
        version: 'v1.0',
        agentFunctionResponse: {
          functionCallId: requests[1]!,
          error: { code: 'UNKNOWN_FUNCTION', message: 'Unknown function' },
        },
      },
      {
        version: 'v1.0',
        agentFunctionResponse: { functionCallId: requests[0]!, value: 42 },
      },
    ]);
    await expect(first).resolves.toBe(42);
    await rejected;
  });
});
