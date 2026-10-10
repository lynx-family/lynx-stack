// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, expect, rstest, test } from '@rstest/core';

import {
  normalizeReactLynxSource,
  parseReactLynxSource,
} from '@lynx-js/genui-reactlynx';

import { createTextStreamRoute } from '../app/common/text-stream-route.js';
import { publishReactLynxBuild } from '../app/reactlynx/artifacts.js';

const { putObject } = rstest.hoisted(() => ({
  putObject: rstest.fn(),
}));

rstest.mock('@volcengine/tos-sdk', () => ({
  TosClient: class {
    putObject = putObject;
  },
}));

const source = {
  files: {
    'App.tsx': 'export default function App() { return <text>Hello</text>; }',
    'App.css': '',
  },
};
const usage = { inputTokens: 12, outputTokens: 24 };

afterEach(() => {
  putObject.mockReset();
  rstest.restoreAllMocks();
  rstest.unstubAllEnvs();
});

test('uses the shared ReactLynx source contract', () => {
  expect(parseReactLynxSource(JSON.stringify(source))).toEqual(source);
});

function route(
  postprocess: Parameters<typeof createTextStreamRoute>[0]['postprocess'],
  emitPerformanceEvents?: (
    observer:
      | ((event: string, details?: Record<string, unknown>) => void)
      | undefined,
  ) => void,
  generatedText = JSON.stringify(source),
) {
  return createTextStreamRoute({
    scope: 'test:reactlynx',
    path: '/reactlynx/stream',
    normalizeFinalText: normalizeReactLynxSource,
    getService: () => ({
      streamAsAsyncIterable: (_messages, options) => {
        emitPerformanceEvents?.(options.onPerformanceEvent);
        return Promise.resolve({
          textStream: (async function*() {
            yield await Promise.resolve(generatedText);
          })(),
          finalize: async () => ({
            text: generatedText,
            usage,
            finishReason: 'stop',
          }),
        });
      },
    }),
    postprocess,
  });
}

function request(app: ReturnType<typeof route>) {
  return app.request('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Create a card' }],
    }),
  });
}

test.each([1, 2])(
  'normalizes %i missing source braces before compilation',
  async count => {
    const canonical = JSON.stringify(source);
    const build = rstest.fn((text: string) => {
      expect(text).toBe(canonical);
      expect(parseReactLynxSource(text)).toEqual(source);
      return Promise.resolve({
        artifact: { webUrl: 'https://example.com/main.web.js' },
      });
    });
    const response = await request(
      route(build, undefined, canonical.slice(0, -count)),
    );
    const body = await response.text();
    expect(build).toHaveBeenCalledTimes(1);
    expect(body).toContain('event: done');
    expect(body).not.toContain('event: error');
    expect(body).toContain('"usage":{"inputTokens":12,"outputTokens":24}');
  },
);

test('build events precede done and preserve generation usage', async () => {
  const app = route((_text, {
    emit,
    recordArtifactBuild,
    recordArtifactUpload,
  }) => {
    emit('build', { status: 'building' });
    recordArtifactBuild(320);
    recordArtifactUpload(45);
    return Promise.resolve({
      artifact: {
        id: '00000000-0000-4000-8000-000000000000',
        webUrl: 'https://example.com/main.web.js',
        nativeUrl: 'https://example.com/main.lynx.js',
      },
    });
  });
  const response = await request(app);
  const body = await response.text();
  expect(body.indexOf('event: build')).toBeLessThan(
    body.indexOf('event: done'),
  );
  expect(body).toContain('"usage":{"inputTokens":12,"outputTokens":24}');
  expect(body).toContain('"artifact":{"id"');
  expect(body).toContain('"webUrl":"https://example.com/main.web.js"');
  expect(body).not.toContain('"previewUrl"');
  expect(body).not.toContain('"previewBundle"');
  expect(body).toContain('"artifactBuildMs":320');
  expect(body).toContain('"artifactUploadMs":45');
});

test('reports search and image-generation time', async () => {
  const app = route(
    () => Promise.resolve({}),
    observer => {
      observer?.('agent.tool.completed', {
        callId: 'reactlynx-search',
        toolName: 'web_search',
        durationMs: 75,
        status: 'success',
      });
      observer?.('agent.tool.completed', {
        callId: 'reactlynx-image-generation',
        toolName: 'generate_image',
        durationMs: 125,
        status: 'success',
      });
    },
  );

  const response = await request(app);
  const body = await response.text();

  expect(body).toContain('"searchMs":75');
  expect(body).toContain('"imageGenerationMs":125');
});

test('a failed build emits error with usage and never a successful artifact', async () => {
  const response = await request(
    route((_text, { recordArtifactBuild }) => {
      recordArtifactBuild(210);
      return Promise.reject(new Error('Invalid JSX in App.tsx'));
    }),
  );
  const body = await response.text();
  expect(body).toContain('event: error');
  expect(body).toContain('Invalid JSX in App.tsx');
  expect(body).toContain('"usage":{"inputTokens":12,"outputTokens":24}');
  expect(body).toContain('"artifactBuildMs":210');
  expect(body).not.toContain('event: done');
});

test('cancelling the response aborts postprocessing', async () => {
  let started!: () => void;
  const ready = new Promise<void>(resolve => {
    started = resolve;
  });
  let signal: AbortSignal | undefined;
  const response = await request(route(async (_text, context) => {
    signal = context.signal;
    started();
    await new Promise<void>(resolve =>
      context.signal.addEventListener('abort', () => resolve(), { once: true })
    );
    return {};
  }));
  await ready;
  await response.body!.cancel();
  expect(signal?.aborted).toBe(true);
});

test('uploads all ReactLynx outputs to persistent TOS storage', async () => {
  rstest.stubEnv('TOS_ACCESS_KEY', 'ak');
  rstest.stubEnv('TOS_SECRET_KEY', 'sk');
  rstest.stubEnv('TOS_BUCKET', 'genui');
  rstest.stubEnv('TOS_REGION', 'cn-beijing');
  rstest.stubEnv('TOS_REACTLYNX_STORAGE_PREFIX', '/custom-reactlynx/');
  rstest.spyOn(crypto, 'randomUUID').mockReturnValue(
    '00000000-0000-4000-8000-000000000000',
  );
  const binary = Buffer.from([0, 255, 1, 128]);
  const assets = [
    { name: 'main.web.js', data: binary },
    { name: 'main.lynx.js', data: binary },
    { name: 'async/chunk.js', data: Buffer.from('export default 1') },
    { name: 'styles.css', data: Buffer.from('.root {}') },
  ];

  await expect(
    publishReactLynxBuild(assets, new AbortController().signal),
  ).resolves.toEqual({
    id: '00000000-0000-4000-8000-000000000000',
    webUrl:
      'https://genui.tos-cn-beijing.volces.com/custom-reactlynx/preview/00000000-0000-4000-8000-000000000000/main.web.js',
    nativeUrl:
      'https://genui.tos-cn-beijing.volces.com/custom-reactlynx/preview/00000000-0000-4000-8000-000000000000/main.lynx.js',
  });
  expect(putObject).toHaveBeenCalledTimes(assets.length);
  expect(putObject).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({
      body: binary,
      bucket: 'genui',
      contentType: 'application/octet-stream',
      key:
        'custom-reactlynx/preview/00000000-0000-4000-8000-000000000000/main.web.js',
    }),
  );
  expect(putObject).toHaveBeenNthCalledWith(
    3,
    expect.objectContaining({
      contentType: 'text/javascript',
      key:
        'custom-reactlynx/preview/00000000-0000-4000-8000-000000000000/async/chunk.js',
    }),
  );
  expect(putObject).toHaveBeenNthCalledWith(
    4,
    expect.objectContaining({
      contentType: 'text/css',
      key:
        'custom-reactlynx/preview/00000000-0000-4000-8000-000000000000/styles.css',
    }),
  );
});

test('requires persistent TOS storage for ReactLynx outputs', async () => {
  rstest.stubEnv('TOS_ACCESS_KEY', '');

  await expect(
    publishReactLynxBuild([], new AbortController().signal),
  ).rejects.toThrow(
    'ReactLynx artifact publishing requires Volcengine TOS configuration',
  );
  expect(putObject).not.toHaveBeenCalled();
});

test('fails the ReactLynx result when persistent upload fails', async () => {
  rstest.stubEnv('TOS_ACCESS_KEY', 'ak');
  rstest.stubEnv('TOS_SECRET_KEY', 'sk');
  rstest.stubEnv('TOS_BUCKET', 'genui');
  rstest.stubEnv('TOS_REGION', 'cn-beijing');
  putObject.mockRejectedValueOnce(new Error('upload failed'));

  await expect(
    publishReactLynxBuild(
      [{ name: 'main.web.js', data: Buffer.from('web') }],
      new AbortController().signal,
    ),
  ).rejects.toThrow('upload failed');
});
