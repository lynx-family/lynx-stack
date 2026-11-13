// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/** @rstest-environment jsdom */

import { expect, rstest, test } from '@rstest/core';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';

import { A2UIRender } from './a2ui.js';

const mock = rstest.hoisted(() => ({
  view: {
    sendGlobalEvent: rstest.fn(),
    onNativeModulesCall: undefined as
      | ((name: string, data: unknown, module: string) => unknown)
      | undefined,
  },
}));
rstest.mock('./bundled.js', () => ({
  useBundledRender: () => ({
    view: null,
    initData: {},
    initDataRef: { current: {} },
    setInitData: rstest.fn(),
    lynxViewRef: { current: mock.view },
    clearTtiTimer: rstest.fn(),
    scheduleFmpMetric: rstest.fn(),
    scheduleTtiMetric: rstest.fn(),
    scheduleRenderMetric: rstest.fn(),
  }),
}));

test('forwards renderer RPC and data-model metadata through the split preview entry', async () => {
  rstest.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const postMessage = rstest.fn();
  rstest.stubGlobal('parent', { postMessage });
  const root = createRoot(document.createElement('div'));
  const payload = {
    message: {
      version: '1.0',
      callAgentFunction: { functionCallId: 'rpc', name: 'lookup', args: {} },
    },
    metadata: { version: '1.0', dataModels: { main: { query: 'hello' } } },
  };
  try {
    await act(async () => root.render(createElement(A2UIRender)));
    mock.view.onNativeModulesCall!('A2UI_PROTOCOL_MESSAGE', payload, 'bridge');
    expect(postMessage).toHaveBeenCalledWith({
      type: 'A2UI_PROTOCOL_MESSAGE',
      ...payload,
    }, '*');
    postMessage.mockClear();
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'A2UI_PROTOCOL_MESSAGE', ...payload },
      }),
    );
    expect(postMessage).toHaveBeenCalledWith({
      type: 'A2UI_PROTOCOL_MESSAGE',
      ...payload,
    }, '*');
  } finally {
    await act(async () => root.unmount());
    rstest.unstubAllGlobals();
  }
});
