// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import {
  normalizeMcpAppHeight,
  resolveMcpAppBundleUrl,
} from '../src/catalog/McpApp/frame.js';

describe('McpApp frame', () => {
  test('selects the platform-specific trusted bundle', () => {
    expect(resolveMcpAppBundleUrl(false, ' native.lynx.js '))
      .toBe('native.lynx.js');
    expect(resolveMcpAppBundleUrl(true, 'native.lynx.js', ' web.js '))
      .toBe('web.js');
  });

  test('does not load the native bundle on web', () => {
    expect(resolveMcpAppBundleUrl(true, 'native.lynx.js')).toBe('');
  });

  test('normalizes invalid frame heights', () => {
    expect(normalizeMcpAppHeight(560)).toBe(560);
    expect(normalizeMcpAppHeight(0)).toBe(480);
    expect(normalizeMcpAppHeight(Number.NaN)).toBe(480);
  });
});
