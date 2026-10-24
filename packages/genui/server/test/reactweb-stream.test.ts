// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, expect, rstest, test } from '@rstest/core';

import { buildReactWeb } from '@lynx-js/genui-reactweb';
import * as compiler from '@lynx-js/genui-reactweb' with {
  rstest: 'importActual',
};

import { publishReactWebBuild } from '../app/reactweb/artifacts.js';
import route from '../app/reactweb/stream/route.js';
import { getReactWebAgentService } from '../service/reactweb/reactweb-agent.js';

rstest.mock('@lynx-js/genui-reactweb', () => ({
  ...compiler,
  buildReactWeb: rstest.fn(),
}));
rstest.mock('../app/reactweb/artifacts.js', () => ({
  publishReactWebBuild: rstest.fn(),
}));
rstest.mock('../service/reactweb/reactweb-agent.js', () => ({
  getReactWebAgentService: rstest.fn(),
}));

const files = {
  'App.tsx': 'export default () => <button>Hello</button>;',
  'App.css': '',
};
const source = JSON.stringify({ files });
const html = '<!doctype html><html><body>Hello</body></html>';
const artifact: Awaited<ReturnType<typeof publishReactWebBuild>> = {
  id: '00000000-0000-4000-8000-000000000000',
  webUrl: 'https://example.com/index.html',
};

beforeEach(() => {
  rstest.mocked(getReactWebAgentService).mockReturnValue({
    streamAsAsyncIterable: (
      _messages: unknown,
      options: Parameters<
        ReturnType<typeof getReactWebAgentService>['streamAsAsyncIterable']
      >[1],
    ) => {
      options?.onPerformanceEvent?.('agent.tool.completed', {
        callId: 'search-1',
        toolName: 'web_search',
        durationMs: 25,
        status: 'success',
      });
      return Promise.resolve({
        textStream: (async function*() {
          yield await Promise.resolve(source);
        })(),
        finalize: () =>
          Promise.resolve({
            text: source,
            usage: { inputTokens: 12, outputTokens: 24 },
            finishReason: 'stop',
          }),
      });
    },
  } as unknown as ReturnType<typeof getReactWebAgentService>);
  rstest.mocked(buildReactWeb).mockImplementation(
    (_source, _signal, onStatus) => {
      onStatus('queued');
      onStatus('building');
      return Promise.resolve(html);
    },
  );
  rstest.mocked(publishReactWebBuild).mockResolvedValue(artifact);
});
afterEach(() => {
  rstest.resetAllMocks();
});

function request() {
  return route.request('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Create a card' }],
    }),
  });
}

function frames(body: string) {
  return body.trim().split('\n\n').map(frame => ({
    event: /^event: (.+)$/mu.exec(frame)?.[1],
    data: JSON.parse(/^data: (.+)$/mu.exec(frame)![1]!) as Record<
      string,
      unknown
    >,
  }));
}

test('builds and publishes before done while preserving usage and timings', async () => {
  let finishUpload!: (value: typeof artifact) => void;
  let started!: () => void;
  const uploading = new Promise<void>(resolve => {
    started = resolve;
  });
  rstest.mocked(publishReactWebBuild).mockImplementation(() => {
    started();
    return new Promise(resolve => {
      finishUpload = resolve;
    });
  });
  const response = await request();
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let body = '';
  await uploading;
  while (!body.includes('"publishing"')) {
    const { value } = await reader.read();
    body += decoder.decode(value);
  }
  expect(body).not.toContain('event: done');
  finishUpload(artifact);
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    body += decoder.decode(value);
  }
  reader.releaseLock();
  const events = frames(body);
  expect(events.filter(x => x.event === 'build').map(x => x.data.status))
    .toEqual(['queued', 'building', 'publishing', 'ready']);
  expect(events.at(-1)).toMatchObject({
    event: 'done',
    data: {
      text: source,
      usage: { inputTokens: 12, outputTokens: 24 },
      metadata: { artifact },
      metrics: {
        searchMs: 25,
        artifactBuildMs: expect.any(Number) as unknown,
        artifactUploadMs: expect.any(Number) as unknown,
      },
    },
  });
  expect(buildReactWeb).toHaveBeenCalledWith(
    { files },
    expect.any(AbortSignal),
    expect.any(Function),
  );
  expect(publishReactWebBuild).toHaveBeenCalledWith(
    html,
    expect.any(AbortSignal),
  );
});

test.each(['build', 'upload'])(
  '%s failure preserves usage without a done event',
  async stage => {
    if (stage === 'build') {
      rstest.mocked(buildReactWeb).mockImplementation(
        (_source, _signal, status) => {
          status('building');
          return Promise.reject(new Error('compile failed'));
        },
      );
    } else {
      rstest.mocked(publishReactWebBuild).mockRejectedValue(
        new Error('upload failed'),
      );
    }
    const response = await request();
    const events = frames(await response.text());
    expect(events.some(x => x.event === 'done')).toBe(false);
    expect(events.at(-1)).toMatchObject({
      event: 'error',
      data: {
        usage: { inputTokens: 12, outputTokens: 24 },
        metrics: { artifactBuildMs: expect.any(Number) as unknown },
      },
    });
    if (stage === 'build') expect(publishReactWebBuild).not.toHaveBeenCalled();
  },
);

test('cancelling the response aborts the compiler and prevents publication', async () => {
  let started!: () => void;
  const ready = new Promise<void>(resolve => {
    started = resolve;
  });
  let buildSignal: AbortSignal | undefined;
  rstest.mocked(buildReactWeb).mockImplementation((_source, signal, status) => {
    buildSignal = signal;
    status('building');
    started();
    return new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('cancelled')), {
        once: true,
      });
    });
  });
  const response = await request();
  await ready;
  await response.body!.cancel();
  expect(buildSignal?.aborted).toBe(true);
  expect(publishReactWebBuild).not.toHaveBeenCalled();
});
