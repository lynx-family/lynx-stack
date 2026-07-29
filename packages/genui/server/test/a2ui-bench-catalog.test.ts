// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import { resolveBenchCatalog } from '../service/a2ui-bench-catalog.js';

describe('resolveBenchCatalog', () => {
  test.each(
    [
      'Full Catalog',
      'Core Catalog',
      'Minimal Catalog',
    ] as const,
  )('removes openUrl from %s', (label) => {
    const catalog = resolveBenchCatalog(label);

    expect(catalog.functions?.some((fn) => fn.name === 'openUrl')).toBe(false);
  });
});
