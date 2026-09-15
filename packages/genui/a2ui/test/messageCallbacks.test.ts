// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, rstest, test } from '@rstest/core';

import { createElement } from '@lynx-js/react';
import { render, waitFor } from '@lynx-js/react/testing-library';

import { A2UI } from '../src/react/A2UI.jsx';
import { createMessageStore } from '../src/store/MessageStore.js';
import type { ServerToClientMessage } from '../src/store/types.js';

describe('A2UI message callbacks', () => {
  test.each(['sync', 'async'])(
    'isolates %s onMessage failures',
    async (mode) => {
      const failure = new Error('Transport failed');
      const log = rstest.spyOn(console, 'error').mockImplementation(() =>
        undefined
      );
      const onMessage = rstest.fn(() => {
        if (mode === 'sync') throw failure;
        return Promise.reject(failure);
      });
      const store = createMessageStore({
        initialMessages: [{
          version: 'v0.9',
          createSurface: { surfaceId: 'old' },
        }] as unknown as ServerToClientMessage[],
      });
      const view = render(createElement(A2UI, {
        messageStore: store,
        catalogs: [],
        onMessage,
      }));
      try {
        await waitFor(() => {
          expect(onMessage).toHaveBeenCalled();
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
