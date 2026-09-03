// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import type { CatalogFunctionEntry } from '../src/catalog/defineCatalog.js';
import {
  createActionMessage,
  createUserActionPayload,
} from '../src/react/useAction.js';
import { evaluateChecks } from '../src/react/useChecks.js';
import { MessageProcessor } from '../src/store/MessageProcessor.js';

describe('A2UI v1.0 client behavior', () => {
  test('resolves dynamic userMessage and context when an action is sent', () => {
    const processor = new MessageProcessor();
    const surface = processor.getOrCreateSurface('checkout');
    surface.store.update('/status', 'Order submitted');

    const payload = createUserActionPayload(
      {
        event: {
          name: 'submit',
          userMessage: { path: '/status' },
          context: {
            status: { path: '/status' },
            summary: {
              call: 'summarize',
              args: { value: { path: '/status' } },
            },
          },
        },
      },
      { id: 'submit-button', surfaceId: 'checkout' },
      processor,
      [
        {
          kind: 'function',
          name: 'summarize',
          impl: ({ value }) => `Summary: ${String(value)}`,
        },
      ],
      '2026-08-19T00:00:00.000Z',
    );

    expect(payload).toEqual({
      name: 'submit',
      userMessage: 'Order submitted',
      surfaceId: 'checkout',
      sourceComponentId: 'submit-button',
      timestamp: '2026-08-19T00:00:00.000Z',
      context: {
        status: 'Order submitted',
        summary: 'Summary: Order submitted',
      },
    });
    expect(createActionMessage(payload!)).toEqual({
      version: 'v1.0',
      action: payload,
    });
    expect(createActionMessage(payload!)).not.toHaveProperty('userAction');
  });

  test('accepts v1.0 ValidationResult and v0.9 boolean checks', () => {
    const processor = new MessageProcessor();
    const surface = processor.getOrCreateSurface('form');
    const functions: CatalogFunctionEntry[] = [
      {
        kind: 'function',
        name: 'validateName',
        impl: () => ({
          valid: false,
          code: 'name_missing',
          message: 'Enter a name',
        }),
      },
      {
        kind: 'function',
        name: 'legacyCheck',
        impl: () => false,
      },
    ];

    expect(evaluateChecks(
      processor,
      [
        { condition: { call: 'validateName' } },
        {
          condition: { call: 'legacyCheck' },
          message: 'Legacy check failed',
        },
      ],
      surface,
      undefined,
      functions,
    )).toEqual({
      ok: false,
      failures: [
        { call: 'validateName', message: 'Enter a name' },
        { call: 'legacyCheck', message: 'Legacy check failed' },
      ],
    });
  });

  test('reindexes array signals after a v1.0 null deletion', () => {
    const processor = new MessageProcessor();
    processor.processMessages([
      {
        version: 'v1.0',
        createSurface: {
          surfaceId: 'list',
          dataModel: {
            items: [
              { name: 'Alpha' },
              { name: 'Beta' },
              { name: 'Gamma' },
            ],
          },
        },
      },
    ]);

    const store = processor.getOrCreateSurface('list').store;
    const firstName = store.getSignal('/items/0/name');
    const secondName = store.getSignal('/items/1/name');
    const staleName = store.getSignal('/items/2/name');

    processor.processMessages([
      {
        version: 'v1.0',
        updateDataModel: {
          surfaceId: 'list',
          path: '/items/0',
          value: null,
        },
      },
    ]);

    expect(firstName.value).toBe('Beta');
    expect(secondName.value).toBe('Gamma');
    expect(staleName.value).toBeUndefined();
    expect(store.getSignal('/').value).toEqual({
      items: [{ name: 'Beta' }, { name: 'Gamma' }],
    });
  });
});
