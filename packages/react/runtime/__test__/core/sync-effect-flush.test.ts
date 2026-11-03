// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { options } from 'preact';
import { describe, expect, it, vi } from 'vitest';

import { withSyncEffectFlush } from '../../src/core/sync-effect-flush.js';

describe('withSyncEffectFlush', () => {
  it('runs requestAnimationFrame callbacks synchronously and restores an unset scheduler', () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalRaf = options.requestAnimationFrame;
    delete options.requestAnimationFrame;
    try {
      const steps: string[] = [];
      const result = withSyncEffectFlush(() => {
        options.requestAnimationFrame?.(() => {
          steps.push('flushed');
        });
        steps.push('after-schedule');
        return 42;
      });

      expect(result).toBe(42);
      expect(steps).toEqual(['flushed', 'after-schedule']);
      expect('requestAnimationFrame' in options).toBe(false);
    } finally {
      if (originalRaf) {
        options.requestAnimationFrame = originalRaf;
      } else {
        delete options.requestAnimationFrame;
      }
    }
  });

  it('restores a previous requestAnimationFrame scheduler even when fn throws', () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalRaf = options.requestAnimationFrame;
    const customRaf = vi.fn();
    options.requestAnimationFrame = customRaf;
    try {
      expect(() =>
        withSyncEffectFlush(() => {
          throw new Error('boom');
        })
      ).toThrow('boom');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(options.requestAnimationFrame).toBe(customRaf);
    } finally {
      if (originalRaf) {
        options.requestAnimationFrame = originalRaf;
      } else {
        delete options.requestAnimationFrame;
      }
    }
  });
});
