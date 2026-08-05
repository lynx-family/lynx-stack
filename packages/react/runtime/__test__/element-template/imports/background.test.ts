// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, it } from 'vitest';

import ReactLynx, { Background } from '@lynx-js/react';

describe('Background (element template runtime)', () => {
  it('is exported from the element-template entry', () => {
    expect(Background).toBeTypeOf('function');
    expect(ReactLynx.Background).toBe(Background);
  });

  it('renders fallback on the main thread and children on the background thread', () => {
    const g = globalThis as unknown as { __MAIN_THREAD__: boolean };
    const previous = g.__MAIN_THREAD__;
    try {
      g.__MAIN_THREAD__ = true;
      expect(Background({ children: 'content', fallback: 'skeleton' })).toBe('skeleton');
      expect(Background({ children: 'content' })).toBeNull();

      g.__MAIN_THREAD__ = false;
      expect(Background({ children: 'content', fallback: 'skeleton' })).toBe('content');
      expect(Background({ fallback: 'skeleton' })).toBeNull();
    } finally {
      g.__MAIN_THREAD__ = previous;
    }
  });
});
