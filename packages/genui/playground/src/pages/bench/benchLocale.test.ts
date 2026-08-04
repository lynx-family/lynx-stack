// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import { DEFAULT_BENCH_LOCALE, parseBenchLocale } from './benchLocale.js';

describe('bench locale', () => {
  test('accepts only supported locale values', () => {
    expect(parseBenchLocale('zh-CN')).toBe('zh-CN');
    expect(parseBenchLocale('en-US')).toBe('en-US');
    expect(parseBenchLocale('en')).toBeNull();
    expect(parseBenchLocale(null)).toBeNull();
    expect(DEFAULT_BENCH_LOCALE).toBe('zh-CN');
  });
});
