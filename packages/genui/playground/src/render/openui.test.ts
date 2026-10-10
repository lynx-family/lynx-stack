// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/** @rstest-environment jsdom */

import { expect, rstest, test } from '@rstest/core';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';

import { OpenUIRender } from './openui.js';

const mock = rstest.hoisted(() => ({
  view: {
    sendGlobalEvent: rstest.fn(),
    onNativeModulesCall: undefined as
      | ((name: string, data: unknown, module: string) => unknown)
      | undefined,
  },
  clearTtiTimer: rstest.fn(),
  scheduleFmpMetric: rstest.fn(),
  scheduleTtiMetric: rstest.fn(),
  scheduleRenderMetric: rstest.fn(),
}));
rstest.mock('./bundled.js', () => ({
  useBundledRender: () => ({
    ...mock,
    view: null,
    initData: { liveStream: true },
    setInitData: rstest.fn(),
    lynxViewRef: { current: mock.view },
    previewNavigationToken: 'test',
    initDataRef: { current: { liveStream: true } },
  }),
}));

async function post(
  rawText: string,
  isStreaming: boolean,
  origin = window.location.origin,
) {
  await act(async () =>
    window.dispatchEvent(
      new MessageEvent('message', {
        source: window.parent,
        origin,
        data: {
          type: 'A2UI_LIVE_MESSAGES',
          messages: [{ rawText, isStreaming }],
        },
      }),
    )
  );
}

test('coalesces boot-time snapshots then forwards streaming and terminal state to Lynx', async () => {
  rstest.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div');
  const root = createRoot(container);
  try {
    await act(async () => root.render(createElement(OpenUIRender)));
    await post('root = ', true);
    await post('root = Text("实时")', true);
    expect(mock.view.sendGlobalEvent).not.toHaveBeenCalled();
    await act(async () =>
      mock.view.onNativeModulesCall!('OPENUI_RUNTIME_READY', {}, 'bridge')
    );
    expect(mock.view.sendGlobalEvent).toHaveBeenLastCalledWith(
      'OPENUI_LIVE_RESPONSE',
      [{
        rawText: 'root = Text("实时")',
        isStreaming: true,
      }],
    );
    await post('root = Text("实时输出")', true);
    expect(mock.clearTtiTimer).toHaveBeenCalled();
    await post('root = Text("实时输出")', false);
    expect(mock.view.sendGlobalEvent).toHaveBeenLastCalledWith(
      'OPENUI_LIVE_RESPONSE',
      [{
        rawText: 'root = Text("实时输出")',
        isStreaming: false,
      }],
    );
    expect(mock.scheduleTtiMetric).toHaveBeenCalled();
    const callCount = mock.view.sendGlobalEvent.mock.calls.length;
    await post('ignored', false, 'https://another.example');
    expect(mock.view.sendGlobalEvent).toHaveBeenCalledTimes(callCount);
  } finally {
    await act(async () => root.unmount());
    rstest.unstubAllGlobals();
  }
});
