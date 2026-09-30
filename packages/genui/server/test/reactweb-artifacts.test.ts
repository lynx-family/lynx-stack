// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, expect, rstest, test } from '@rstest/core';

import { publishReactWebBuild } from '../app/reactweb/artifacts.js';

const { putObject } = rstest.hoisted(() => ({ putObject: rstest.fn() }));
rstest.mock('@volcengine/tos-sdk', () => ({
  TosClient: class {
    putObject = putObject;
  },
}));
const html = '<!doctype html><html><body>Hello</body></html>';

beforeEach(() => {
  rstest.stubEnv('TOS_ACCESS_KEY', 'ak');
  rstest.stubEnv('TOS_SECRET_KEY', 'sk');
  rstest.stubEnv('TOS_BUCKET', 'genui');
  rstest.stubEnv('TOS_REGION', 'cn-beijing');
  rstest.stubEnv('TOS_REACTWEB_STORAGE_PREFIX', '/custom-reactweb/');
});
afterEach(() => {
  putObject.mockReset();
  rstest.unstubAllEnvs();
});

test('publishes one HTML artifact through the protocol storage prefix', async () => {
  const artifact = await publishReactWebBuild(
    html,
    new AbortController().signal,
  );
  expect(putObject).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    bucket: 'genui',
    body: Buffer.from(html),
    key: `custom-reactweb/preview/${artifact.id}/index.html`,
    contentType: 'text/html; charset=utf-8',
  }));
  expect(artifact.webUrl).toBe(
    `https://genui.tos-cn-beijing.volces.com/custom-reactweb/preview/${artifact.id}/index.html`,
  );
});

test('requires persistent storage configuration', async () => {
  rstest.stubEnv('TOS_ACCESS_KEY', '');
  await expect(publishReactWebBuild(html, new AbortController().signal))
    .rejects.toThrow('requires Volcengine TOS configuration');
  expect(putObject).not.toHaveBeenCalled();
});

test('propagates upload failures without returning a URL', async () => {
  putObject.mockRejectedValueOnce(new Error('upload failed'));
  await expect(publishReactWebBuild(html, new AbortController().signal))
    .rejects.toThrow('upload failed');
});

test('does not return an artifact when cancelled during upload', async () => {
  const controller = new AbortController();
  putObject.mockImplementationOnce(() => {
    controller.abort(new Error('Cancelled upload'));
    return Promise.resolve();
  });
  await expect(publishReactWebBuild(html, controller.signal))
    .rejects.toThrow('Cancelled upload');
});
