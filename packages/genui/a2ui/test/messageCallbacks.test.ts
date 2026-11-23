// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, rstest, test } from '@rstest/core';

import { createElement } from '@lynx-js/react';
import { render, waitFor } from '@lynx-js/react/testing-library';

import type { CatalogFunctionEntry } from '../src/catalog/defineCatalog.js';
import { A2UI } from '../src/react/A2UI.jsx';
import { createMessageStore } from '../src/store/MessageStore.js';
import type {
  RendererToAgentMessage,
  ServerToClientMessage,
} from '../src/store/types.js';

describe('A2UI message callbacks', () => {
  test.each([
    ['sync', 'invalid-version'],
    ['async', 'invalid-version'],
    ['sync', 'renderer-response'],
    ['async', 'renderer-response'],
  ])(
    'isolates %s onMessage failures for %s',
    async (mode, source) => {
      const failure = new Error('Transport failed');
      const log = rstest.spyOn(console, 'error').mockImplementation(() =>
        undefined
      );
      const onMessage = rstest.fn((_message: RendererToAgentMessage) => {
        if (mode === 'sync') throw failure;
        return Promise.reject(failure);
      });
      const store = createMessageStore({
        initialMessages: source === 'invalid-version'
          ? [{
            version: 'v0.9',
            createSurface: { surfaceId: 'old' },
          }] as unknown as ServerToClientMessage[]
          : [{
            version: '1.0',
            callRendererFunction: {
              functionCallId: 'ready-call',
              callFunction: { catalogId: 'test', '@call': 'ready' },
            },
          }],
      });
      const view = render(createElement(A2UI, {
        messageStore: store,
        catalogId: 'test',
        catalogs: [
          {
            kind: 'function',
            name: 'ready',
            impl: () => true,
            definition: {
              name: 'ready',
              parameters: {},
              returnType: 'boolean',
              allowedCallers: 'rendererOrAgent',
            },
          } satisfies CatalogFunctionEntry,
        ],
        onMessage,
      }));
      try {
        await waitFor(() => {
          expect(onMessage).toHaveBeenCalled();
          if (source === 'renderer-response') {
            expect(onMessage.mock.calls[0]?.[0]).toEqual({
              version: '1.0',
              rendererFunctionResponse: {
                functionCallId: 'ready-call',
                value: true,
              },
            });
          }
          expect(log).toHaveBeenCalledWith(
            mode === 'sync'
              ? '[a2ui] onMessage handler threw:'
              : '[a2ui] onMessage handler rejected:',
            failure,
          );
        });
      } finally {
        view.unmount();
        log.mockRestore();
      }
    },
  );
});
