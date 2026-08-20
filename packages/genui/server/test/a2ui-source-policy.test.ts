// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import { createA2UISourcePolicy } from '../agent/a2ui-source-policy.js';

describe('createA2UISourcePolicy', () => {
  test('uses the supplied normalizer for nested, embedded, and dynamic sources', () => {
    const dynamicSources: string[] = [];
    const policy = createA2UISourcePolicy(
      [
        'Use [the primary source](source:ONE).',
        { nested: JSON.stringify({ value: 'source:TWO' }) },
      ],
      (source) => {
        const normalized = source.trim().toLowerCase();
        return normalized.startsWith('source:') ? normalized : undefined;
      },
      () => dynamicSources,
    );

    expect(policy('source:one')).toBe(true);
    expect(policy('SOURCE:TWO')).toBe(true);
    expect(policy('source:three')).toBe(false);

    dynamicSources.push('SOURCE:THREE');
    expect(policy('source:three')).toBe(true);
    expect(policy('https://example.com/not-supported')).toBe(false);
  });

  test('handles cyclic provided values', () => {
    const cyclic: { source: string; self?: unknown } = {
      source: 'source:one',
    };
    cyclic.self = cyclic;

    const policy = createA2UISourcePolicy(
      [cyclic],
      (source) => source.startsWith('source:') ? source : undefined,
    );

    expect(policy('source:one')).toBe(true);
  });
});
