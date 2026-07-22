/*
 * Copyright 2026 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

import './jsdom.js';
import { expect, test } from '@rstest/core';

import { createChunkLoading } from '../ts/client/background/background-apis/createChunkLoading.js';

test('external bundle execution uses the bundle URL as location', () => {
  const originalXMLHttpRequest = globalThis.XMLHttpRequest;
  class FakeXMLHttpRequest {
    status = 200;
    responseText =
      'module.exports = [globalThis.location.href, globalThis.self === globalThis];';
    open() {}
    send() {}
  }
  globalThis.XMLHttpRequest =
    FakeXMLHttpRequest as unknown as typeof XMLHttpRequest;

  try {
    const bundleURL = 'https://cdn.example.com/remotes/catalog.web.bundle';
    const { loadScript } = createChunkLoading('app.web.bundle', 'react');
    const script = loadScript('catalog', bundleURL);

    expect(
      script.init({ tt: {} } as Parameters<typeof script.init>[0]),
    ).toEqual([bundleURL, true]);
  } finally {
    globalThis.XMLHttpRequest = originalXMLHttpRequest;
  }
});
