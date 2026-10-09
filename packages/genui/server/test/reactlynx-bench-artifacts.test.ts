// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, expect, rstest, test } from '@rstest/core';
import { unzipSync } from 'fflate';

import { publishReactLynxBenchBuild } from '../service/reactlynx/reactlynx-bench-artifacts.js';

const { putObject } = rstest.hoisted(() => ({
  putObject: rstest.fn<(input: { body: Buffer }) => Promise<void>>(),
}));
rstest.mock('@volcengine/tos-sdk', () => ({
  TosClient: class {
    putObject = putObject;
  },
}));
const assets = [
  { name: 'main.lynx.js', data: Buffer.from([0, 255, 1, 128]) },
  { name: 'main.web.js', data: Buffer.from([3, 2, 1]) },
  { name: 'chunks/shared.js', data: Buffer.from('shared') },
];

beforeEach(() => {
  rstest.stubEnv('TOS_ACCESS_KEY', 'ak');
  rstest.stubEnv('TOS_SECRET_KEY', 'sk');
  rstest.stubEnv('TOS_BUCKET', 'genui');
  rstest.stubEnv('TOS_REGION', 'cn-beijing');
  rstest.stubEnv('TOS_ENDPOINT', 'tos-cn-beijing.volces.com');
  rstest.stubEnv('TOS_REACTLYNX_STORAGE_PREFIX', '/create-only/');
  rstest.stubEnv('TOS_REACTLYNX_BENCH_STORAGE_PREFIX', '');
});
afterEach(() => {
  putObject.mockReset();
  rstest.unstubAllEnvs();
});

test.each(['', '/custom-bench/'])(
  'publishes an intact ZIP through an independent Bench prefix: %s',
  async (prefix) => {
    rstest.stubEnv('TOS_REACTLYNX_BENCH_STORAGE_PREFIX', prefix);
    const artifact = await publishReactLynxBenchBuild(
      assets,
      new AbortController().signal,
    );
    const key = `${
      prefix ? 'custom-bench' : 'reactlynx-bench'
    }/preview/${artifact.id}/bundle.zip`;
    expect(putObject).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      bucket: 'genui',
      key,
      contentType: 'application/zip',
      body: expect.any(Buffer) as unknown,
    }));
    expect(artifact.zipUrl).toBe(
      `https://genui.tos-cn-beijing.volces.com/${key}`,
    );
    const archive = putObject.mock.calls[0]![0]!.body as Buffer;
    const files = unzipSync(archive);
    expect(Object.keys(files)).toEqual(assets.map(asset => asset.name));
    for (const asset of assets) {
      expect(Buffer.from(files[asset.name]!)).toEqual(asset.data);
    }
    const next = await publishReactLynxBenchBuild(
      assets,
      new AbortController().signal,
    );
    expect(next.zipUrl).not.toBe(artifact.zipUrl);
  },
);

test('fails without persistent storage configuration before upload', async () => {
  rstest.stubEnv('TOS_ACCESS_KEY', '');
  await expect(publishReactLynxBenchBuild(assets, new AbortController().signal))
    .rejects.toThrow('requires Volcengine TOS configuration');
  expect(putObject).not.toHaveBeenCalled();
});

test('propagates upload failure without returning an artifact', async () => {
  putObject.mockRejectedValueOnce(new Error('CDN unavailable'));
  await expect(publishReactLynxBenchBuild(assets, new AbortController().signal))
    .rejects.toThrow('CDN unavailable');
});

test.each([false, true])(
  'cancellation prevents artifact delivery (during upload=%s)',
  async duringUpload => {
    const controller = new AbortController();
    if (duringUpload) {
      putObject.mockImplementationOnce(() => {
        controller.abort(new Error('Cancelled'));
        return Promise.resolve();
      });
    } else {
      controller.abort(new Error('Cancelled'));
    }
    await expect(publishReactLynxBenchBuild(assets, controller.signal)).rejects
      .toThrow('Cancelled');
    expect(putObject).toHaveBeenCalledTimes(duringUpload ? 1 : 0);
  },
);

test.each([
  [],
  [{ name: 'main.web.js', data: Buffer.from([1]) }],
  [{ name: 'main.lynx.js', data: Buffer.alloc(0) }],
  [assets[0]!, assets[0]!],
  [assets[0]!, { name: '../escape.js', data: Buffer.from([1]) }],
  [assets[0]!, { name: '/absolute.js', data: Buffer.from([1]) }],
  [assets[0]!, { name: 'x'.repeat(256), data: Buffer.from([1]) }],
  Array.from(
    { length: 101 },
    (_, i) => ({ name: `${i}.js`, data: Buffer.from([1]) }),
  ),
  [{ name: 'main.lynx.js', data: Buffer.alloc(10 * 1024 * 1024 + 1) }],
  // Entry data fits, but ZIP headers put the final archive over the limit.
  [{ name: 'main.lynx.js', data: Buffer.alloc(10 * 1024 * 1024) }],
].map(input => ({ input })))(
  'rejects invalid or oversized archives before CDN upload %#',
  async ({ input }) => {
    await expect(
      publishReactLynxBenchBuild(input, new AbortController().signal),
    ).rejects.toThrow();
    expect(putObject).not.toHaveBeenCalled();
  },
);
