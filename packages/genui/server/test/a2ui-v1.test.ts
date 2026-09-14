// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import { loadBasicCatalog } from '../agent/a2ui/a2ui-catalog.js';
import { A2UI_PROTOCOL_VERSION } from '../agent/a2ui/a2ui-prompt.js';
import { A2UIProtocolMessageStreamParser } from '../agent/a2ui/a2ui-stream-parser.js';
import { validateA2UIOutput } from '../agent/a2ui/a2ui-validator.js';
import { normalizeRendererEvent } from '../app/a2ui/_shared.js';
import app from '../src/app.js';

describe('A2UI v1.0 server', () => {
  test('validates inline components and data with the existing catalog', async () => {
    const catalog = await loadBasicCatalog();
    const messages = [{
      version: 'v1.0',
      createSurface: {
        surfaceId: 's',
        catalogId: catalog.id,
        components: [{
          id: 'root',
          component: 'Text',
          text: { path: '/name' },
        }],
        dataModel: { name: 'Alice' },
      },
    }];
    const result = validateA2UIOutput(JSON.stringify(messages), catalog);
    expect(result.errors).toEqual([]);
    expect(result.messages).toEqual(messages);
    expect(A2UI_PROTOCOL_VERSION).toBe('v1.0');
    expect(
      validateA2UIOutput(
        JSON.stringify([{
          version: 'v1.0',
          createSurface: {
            surfaceId: 's',
            components: [{
              id: 'root',
              component: 'Text',
              catalogId: catalog.id,
              text: 'Hi',
            }],
          },
        }]),
        catalog,
      ).ok,
    ).toBe(true);
  });

  test('rejects unknown inline components, themes, missing values and unsafe remote calls', async () => {
    const catalog = await loadBasicCatalog();
    for (
      const invalid of [
        {
          version: 'v1.0',
          createSurface: {
            surfaceId: 's',
            catalogId: catalog.id,
            components: [{ id: 'root', component: 'Unknown' }],
          },
        },
        {
          version: 'v1.0',
          createSurface: { surfaceId: 's', catalogId: catalog.id, theme: {} },
        },
        { version: 'v1.0', updateDataModel: { surfaceId: 's' } },
        {
          version: 'v1.0',
          callRendererFunction: {
            functionCallId: 'f',
            callFunction: {
              call: 'openUrl',
              catalogId: catalog.id,
              args: { url: 'https://example.com' },
            },
          },
        },
      ]
    ) {
      expect(
        validateA2UIOutput(JSON.stringify([invalid]), catalog, {
          requireCreateSurface: false,
          existingSurfaceIds: ['s'],
        }).ok,
      ).toBe(false);
    }
  });

  test('streams inline content through source policies and preserves versions at every chunk boundary', async () => {
    const catalog = await loadBasicCatalog();
    const raw = JSON.stringify([{
      version: 'v1.0',
      createSurface: {
        surfaceId: 's',
        catalogId: catalog.id,
        components: [{
          id: 'root',
          component: 'Image',
          url: 'https://untrusted.example/image.png',
        }],
        dataModel: { name: 'Alice' },
      },
    }]);
    for (let split = 1; split < raw.length; split++) {
      const parser = new A2UIProtocolMessageStreamParser({
        isImageSourceAllowed: () => false,
      });
      const messages = [
        ...parser.push(raw.slice(0, split)),
        ...parser.push(raw.slice(split)),
      ];
      expect(messages.every(message => message.version === 'v1.0')).toBe(true);
      expect(JSON.stringify(messages)).not.toContain('untrusted.example');
      expect(messages.some(message => 'updateDataModel' in message)).toBe(true);
      expect(
        messages.some(message =>
          'updateComponents' in message
          && message.updateComponents.components[0]?.component === 'Loading'
        ),
      ).toBe(true);
    }
  });

  test('accepts legacy streams without changing their emitted versions', async () => {
    const catalog = await loadBasicCatalog();
    const raw = JSON.stringify([{
      version: 'v0.9',
      createSurface: { surfaceId: 's', catalogId: catalog.id },
    }, {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 's',
        components: [{ id: 'root', component: 'Text', text: 'legacy' }],
      },
    }]);
    expect(validateA2UIOutput(raw, catalog).ok).toBe(true);
    expect(
      new A2UIProtocolMessageStreamParser().push(raw).every(message =>
        message.version === 'v0.9'
      ),
    ).toBe(true);
  });

  test('maps action surface and data-model metadata into the stateless conversation', () => {
    const body = normalizeRendererEvent({
      version: 'v1.0',
      action: { surfaceId: 's', name: 'submit' },
      metadata: {
        a2uiRendererDataModel: {
          version: 'v1.0',
          surfaces: { s: { name: 'Bob' } },
        },
      },
      conversation: { history: [] },
    });
    expect(body.surfaceId).toBe('s');
    expect(body.conversation).toEqual({
      history: [],
      dataModel: { name: 'Bob' },
    });
  });

  test('keeps RPC replies on the streaming endpoint as SSE', async () => {
    const response = await app.request('/a2ui/action/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '203.0.113.202',
      },
      body: JSON.stringify({
        version: 'v1.0',
        callAgentFunction: {
          surfaceId: 's',
          functionCallId: 'stream-f1',
          callFunction: { call: 'unknown' },
        },
      }),
    });
    expect(response.headers.get('Content-Type')).toContain('text/event-stream');
    const text = await response.text();
    expect(text).toContain('event: done');
    expect(text).toContain('stream-f1');
    expect(text).toContain('UNKNOWN_FUNCTION');
  });

  test('returns a correlated UNKNOWN_FUNCTION without invoking a model', async () => {
    const response = await app.request('/a2ui/action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '203.0.113.201',
      },
      body: JSON.stringify({
        version: 'v1.0',
        callAgentFunction: {
          surfaceId: 's',
          functionCallId: 'f1',
          callFunction: { call: 'verifyProvider', args: {} },
        },
      }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      messages: [{
        version: 'v1.0',
        agentFunctionResponse: {
          functionCallId: 'f1',
          error: {
            code: 'UNKNOWN_FUNCTION',
            message: 'No agent implementation registered for "verifyProvider"',
          },
        },
      }],
    });
  });
});
