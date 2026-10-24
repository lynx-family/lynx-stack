// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, rstest, test } from '@rstest/core';

import { isDebug as isEncodeDebug } from '../src/LynxEncodePlugin.js';
import { isDebug as isTemplateDebug } from '../src/LynxTemplatePlugin.js';
import { isDebug as isTraceDebug } from '../src/worker/encode.js';

function withDebug(value: string, fn: () => void) {
  rstest.stubEnv('DEBUG', value);
  try {
    fn();
  } finally {
    rstest.unstubAllEnvs();
  }
}

describe('isDebug', () => {
  test('the template and encode plugins accept the lynx namespace', () => {
    for (const value of ['lynx', 'lynx:*', 'lynx:template', 'rspeedy']) {
      withDebug(value, () => {
        expect(isTemplateDebug(), value).toBe(true);
        expect(isEncodeDebug(), value).toBe(true);
      });
    }
    withDebug('rslib', () => {
      expect(isTemplateDebug()).toBe(false);
      expect(isEncodeDebug()).toBe(false);
    });
  });

  test('the encode trace only listens to the sub-namespaces', () => {
    for (const value of ['lynx:*', 'lynx:template', 'rspeedy:template']) {
      withDebug(value, () => expect(isTraceDebug(), value).toBe(true));
    }
    withDebug('lynx', () => expect(isTraceDebug()).toBe(false));
  });
});
