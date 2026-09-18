// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import app from '../src/app.js';

interface MockActionService {
  generateValidated(
    messages: unknown,
    options: unknown,
    conversation: unknown,
    validationOptions: unknown,
    abortSignal?: AbortSignal,
  ): Promise<unknown>;
}

type GlobalWithActionService = typeof globalThis & {
  __A2UI_AGENT_SERVICE__?: MockActionService;
};

describe('A2UI action route', () => {
  test('validates against the current surface data model', async () => {
    const global = globalThis as GlobalWithActionService;
    const previousService = global.__A2UI_AGENT_SERVICE__;
    let receivedValidationOptions: unknown;
    global.__A2UI_AGENT_SERVICE__ = {
      generateValidated(
        _messages,
        _options,
        _conversation,
        validationOptions,
      ) {
        receivedValidationOptions = validationOptions;
        return Promise.resolve({
          ok: true,
          text: '',
          messages: [],
          errors: [],
          warnings: [],
          attempts: 1,
        });
      },
    };

    try {
      const dataModel = {
        selectedItem: { id: 'item-7' },
        total: 3,
      };
      const response = await app.request('/a2ui/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '203.0.113.46',
        },
        body: JSON.stringify({
          action: { name: 'refresh' },
          conversation: { history: [], dataModel },
          surfaceId: 'surface-1',
        }),
      });

      expect(response.status).toBe(200);
      expect(receivedValidationOptions).toEqual({
        requireCreateSurface: false,
        existingSurfaceIds: ['surface-1'],
        existingDataModelBySurface: {
          'surface-1': dataModel,
        },
      });
    } finally {
      global.__A2UI_AGENT_SERVICE__ = previousService;
    }
  });

  test('redacts a request-scoped API key from JSON errors', async () => {
    const global = globalThis as GlobalWithActionService;
    const previousService = global.__A2UI_AGENT_SERVICE__;
    const apiKey = 'action-request-secret+/=';
    const encodedKey = encodeURIComponent(apiKey);
    global.__A2UI_AGENT_SERVICE__ = {
      generateValidated() {
        return Promise.reject(
          new Error(`upstream exposed ${apiKey} and ${encodedKey}`),
        );
      },
    };

    try {
      const response = await app.request('/a2ui/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '203.0.113.47',
        },
        body: JSON.stringify({
          action: { name: 'refresh' },
          surfaceId: 'surface-1',
          model: 'gpt-custom',
          apiKey,
          baseURL: 'https://api.openai.com/v1',
        }),
      });
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(body).toContain('[REDACTED]');
      expect(body).not.toContain(apiKey);
      expect(body).not.toContain(encodedKey);
    } finally {
      global.__A2UI_AGENT_SERVICE__ = previousService;
    }
  });
});
