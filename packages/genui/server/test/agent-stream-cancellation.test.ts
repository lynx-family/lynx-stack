// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import app from '../src/app.js';

interface MockStreamingService {
  streamAsAsyncIterable(
    messages: unknown,
    options: unknown,
    conversation: unknown,
    abortSignal?: AbortSignal,
  ): Promise<never>;
}

type GlobalWithStreamingServices = typeof globalThis & {
  __A2UI_AGENT_SERVICE__?: MockStreamingService;
  __HTML_AGENT_SERVICE__?: MockStreamingService;
  __OPENUI_AGENT_SERVICE__?: MockStreamingService;
  __LYNX_XML_AGENT_SERVICE__?: MockStreamingService;
};

function createPendingService(
  receiveSignal: (signal: AbortSignal | undefined) => void,
  receiveMessages: (messages: unknown) => void = () => undefined,
): MockStreamingService {
  return {
    streamAsAsyncIterable(messages, _options, _conversation, abortSignal) {
      receiveMessages(messages);
      receiveSignal(abortSignal);
      return new Promise((_resolve, reject) => {
        const rejectAbort = () => {
          reject(new DOMException('Generation aborted', 'AbortError'));
        };
        if (abortSignal?.aborted) {
          rejectAbort();
        } else {
          abortSignal?.addEventListener('abort', rejectAbort, { once: true });
        }
      });
    },
  };
}

async function cancelResponse(path: string, body: unknown, clientIp: string) {
  const response = await app.request(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': clientIp,
    },
    body: JSON.stringify(body),
  });
  expect(response.status).toBe(200);
  const reader = response.body?.getReader();
  if (!reader) throw new Error('response stream is unavailable');
  await reader.cancel('client disconnected');
}

describe('agent stream cancellation', () => {
  test('aborts OpenUI generation when the response reader disconnects', async () => {
    const global = globalThis as GlobalWithStreamingServices;
    const previousService = global.__OPENUI_AGENT_SERVICE__;
    let receivedSignal: AbortSignal | undefined;
    global.__OPENUI_AGENT_SERVICE__ = createPendingService((signal) => {
      receivedSignal = signal;
    });

    try {
      await cancelResponse(
        '/openui/stream',
        { messages: [{ role: 'user', content: 'Create a card' }] },
        '203.0.113.42',
      );
      expect(receivedSignal?.aborted).toBe(true);
    } finally {
      global.__OPENUI_AGENT_SERVICE__ = previousService;
    }
  });

  test('aborts A2UI generation when the response reader disconnects', async () => {
    const global = globalThis as GlobalWithStreamingServices;
    const previousService = global.__A2UI_AGENT_SERVICE__;
    let receivedSignal: AbortSignal | undefined;
    global.__A2UI_AGENT_SERVICE__ = createPendingService((signal) => {
      receivedSignal = signal;
    });

    try {
      await cancelResponse(
        '/a2ui/stream',
        { messages: [{ role: 'user', content: 'Create a card' }] },
        '203.0.113.43',
      );
      expect(receivedSignal?.aborted).toBe(true);
    } finally {
      global.__A2UI_AGENT_SERVICE__ = previousService;
    }
  });

  test('aborts Lynx XML generation when the response reader disconnects', async () => {
    const global = globalThis as GlobalWithStreamingServices;
    const previousService = global.__LYNX_XML_AGENT_SERVICE__;
    let receivedSignal: AbortSignal | undefined;
    global.__LYNX_XML_AGENT_SERVICE__ = createPendingService((signal) => {
      receivedSignal = signal;
    });

    try {
      await cancelResponse(
        '/lynx-xml/stream',
        { messages: [{ role: 'user', content: 'Create a counter' }] },
        '203.0.113.46',
      );
      expect(receivedSignal?.aborted).toBe(true);
    } finally {
      global.__LYNX_XML_AGENT_SERVICE__ = previousService;
    }
  });

  test('aborts HTML generation when the response reader disconnects', async () => {
    const global = globalThis as GlobalWithStreamingServices;
    const previousService = global.__HTML_AGENT_SERVICE__;
    let receivedSignal: AbortSignal | undefined;
    global.__HTML_AGENT_SERVICE__ = createPendingService((signal) => {
      receivedSignal = signal;
    });

    try {
      await cancelResponse(
        '/html/stream',
        { messages: [{ role: 'user', content: 'Create a dashboard' }] },
        '203.0.113.49',
      );
      expect(receivedSignal?.aborted).toBe(true);
    } finally {
      global.__HTML_AGENT_SERVICE__ = previousService;
    }
  });

  test('aborts A2UI action generation when the response reader disconnects', async () => {
    const global = globalThis as GlobalWithStreamingServices;
    const previousService = global.__A2UI_AGENT_SERVICE__;
    let receivedMessages: unknown;
    let receivedSignal: AbortSignal | undefined;
    global.__A2UI_AGENT_SERVICE__ = createPendingService(
      (signal) => {
        receivedSignal = signal;
      },
      (messages) => {
        receivedMessages = messages;
      },
    );

    try {
      await cancelResponse(
        '/a2ui/action/stream',
        {
          action: {
            context: {},
            name: 'refresh',
            sourceComponentId: 'refresh_button',
            surfaceId: 'surface-1',
            timestamp: '2026-08-19T01:02:03Z',
          },
          version: 'v1.0',
        },
        '203.0.113.44',
      );
      expect(receivedSignal?.aborted).toBe(true);
      expect(receivedMessages).toEqual([{
        content: 'A2UI_USER_ACTION: '
          + JSON.stringify({
            version: 'v1.0',
            action: {
              name: 'refresh',
              surfaceId: 'surface-1',
              sourceComponentId: 'refresh_button',
              timestamp: '2026-08-19T01:02:03Z',
              context: {},
            },
          }),
        role: 'user',
      }]);
    } finally {
      global.__A2UI_AGENT_SERVICE__ = previousService;
    }
  });

  test('aborts generation when the incoming request is aborted', async () => {
    const global = globalThis as GlobalWithStreamingServices;
    const previousService = global.__OPENUI_AGENT_SERVICE__;
    const requestController = new AbortController();
    let receivedSignal: AbortSignal | undefined;
    global.__OPENUI_AGENT_SERVICE__ = createPendingService((signal) => {
      receivedSignal = signal;
    });

    try {
      const response = await app.request('/openui/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '203.0.113.45',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Create a card' }],
        }),
        signal: requestController.signal,
      });
      expect(response.status).toBe(200);

      requestController.abort('request disconnected');

      expect(receivedSignal?.aborted).toBe(true);
      await response.body?.cancel();
    } finally {
      global.__OPENUI_AGENT_SERVICE__ = previousService;
    }
  });
});
