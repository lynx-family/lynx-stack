// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, test } from '@rstest/core';

import { createLepusCodeBlob } from '../ts/client/decodeWorker/createLepusCodeBlob.js';

test('empty lazy main-thread chunks remain valid JavaScript', async () => {
  const blob = createLepusCodeBlob(
    new Uint8Array(),
    'https://example.com/empty.bundle/root',
    true,
    false,
  );
  const execute = new Function('module', await blob.text());
  const module = { exports: undefined };

  expect(() => execute(module)).not.toThrow();
  expect(module.exports).toBeUndefined();
});
