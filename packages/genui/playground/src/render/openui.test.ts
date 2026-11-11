// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/** @rstest-environment jsdom */

import { expect, rstest, test } from '@rstest/core';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';

import { OpenUIRender } from './openui.js';
import { OPENUI_DATA_TOOL } from '../../lynx-src/openui/dataTools.js';

const mock = rstest.hoisted(() => ({
  initData: { liveStream: true } as {
    liveStream: boolean;
    rawTextUrl?: string;
  },
  setInitData: rstest.fn(),
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
    initData: mock.initData,
    setInitData: mock.setInitData,
    lynxViewRef: { current: mock.view },
    previewNavigationToken: 'test',
    initDataRef: { current: { liveStream: true } },
  }),
}));

test('defers fetched source updates until the Web runtime is ready', async () => {
  rstest.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mock.initData.rawTextUrl = './example.txt';
  mock.setInitData.mockClear();
  const rawText = 'root = Text("Loaded source")';
  rstest.stubGlobal(
    'fetch',
    rstest.fn(async () => ({
      ok: true,
      text: async () => rawText,
    })),
  );
  const root = createRoot(document.createElement('div'));
  try {
    await act(async () => root.render(createElement(OpenUIRender)));
    expect(mock.setInitData).not.toHaveBeenCalled();
    await act(async () =>
      mock.view.onNativeModulesCall!('OPENUI_RUNTIME_READY', {}, 'bridge')
    );
    expect(mock.setInitData).toHaveBeenCalledTimes(1);
    const update = mock.setInitData.mock.calls[0]![0] as (
      previous: typeof mock.initData,
    ) => unknown;
    expect(update(mock.initData)).toEqual({ ...mock.initData, rawText });
    const differentSource = { liveStream: true, rawTextUrl: './other.txt' };
    expect(update(differentSource)).toBe(differentSource);
  } finally {
    await act(async () => root.unmount());
    delete mock.initData.rawTextUrl;
    rstest.unstubAllGlobals();
  }
});

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

test('handles local mutations in storage without forwarding an agent action', async () => {
  rstest.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  window.localStorage.clear();
  const postMessage = rstest.spyOn(window.parent, 'postMessage');
  const container = document.createElement('div');
  const root = createRoot(container);
  const request = {
    rawText:
      'counter = Query("openui_query", { key: "counter" }, 0)\nroot = Stack([])',
    args: { key: 'counter' },
  };
  try {
    await act(async () => root.render(createElement(OpenUIRender)));
    expect(mock.view.onNativeModulesCall!(OPENUI_DATA_TOOL, {
      ...request,
      operation: 'initialize',
      args: { defaults: { counter: 0 } },
    }, 'bridge')).toEqual({ ok: true });
    expect(mock.view.onNativeModulesCall!(OPENUI_DATA_TOOL, {
      ...request,
      operation: 'mutation',
      args: {
        key: 'counter',
        value: 1,
      },
    }, 'bridge')).toEqual({ ok: true, value: { ok: true } });
    expect(mock.view.onNativeModulesCall!(OPENUI_DATA_TOOL, {
      ...request,
      operation: 'query',
    }, 'bridge')).toEqual({ ok: true, value: 1 });
    expect(window.localStorage.length).toBe(1);
    expect(postMessage).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
    postMessage.mockRestore();
    window.localStorage.clear();
    rstest.unstubAllGlobals();
  }
});

test.each([false, true])(
  'injects persisted local data before delivery (streaming=%s)',
  async (isStreaming) => {
    rstest.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    window.localStorage.clear();
    const rawText =
      'counter = Query("openui_query", { key: "counter" }, 0)\nroot = Stack([])';
    const root = createRoot(document.createElement('div'));
    try {
      await act(async () => root.render(createElement(OpenUIRender)));
      mock.view.onNativeModulesCall!(OPENUI_DATA_TOOL, {
        rawText,
        operation: 'initialize',
        args: { defaults: { counter: 0 } },
      }, 'bridge');
      mock.view.onNativeModulesCall!(OPENUI_DATA_TOOL, {
        rawText,
        operation: 'mutation',
        args: {
          key: 'counter',
          value: 5,
        },
      }, 'bridge');
      await act(async () =>
        mock.view.onNativeModulesCall!('OPENUI_RUNTIME_READY', {}, 'bridge')
      );
      await post(rawText, isStreaming);
      expect(mock.view.sendGlobalEvent).toHaveBeenLastCalledWith(
        'OPENUI_LIVE_RESPONSE',
        [{
          rawText,
          isStreaming,
          initialQueryResults: { counter: 5 },
        }],
      );
    } finally {
      await act(async () => root.unmount());
      window.localStorage.clear();
      rstest.unstubAllGlobals();
    }
  },
);
