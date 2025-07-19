// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it } from 'vitest';

import { withStringGuard } from '../../plugin-utils/with-string-guard.js';

const doubleFn = (s: string) => `${s}${s}`;

describe('withStringGuard', () => {
  const guarded = withStringGuard(doubleFn);
  it('returns result if value is a string', () => {
    expect(guarded('abc')).toBe('abcabc');
  });

  it('returns null for non-string values', () => {
    expect(guarded(123)).toBeNull();
    expect(guarded(undefined)).toBeNull();
    expect(guarded({})).toBeNull();
  });
});
