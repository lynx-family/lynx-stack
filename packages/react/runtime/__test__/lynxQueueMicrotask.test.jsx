// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => {
  vi.resetModules();
});

describe('lynxQueueMicrotask', () => {
  it('should use lynx.queueMicrotask when available', async () => {
    const mockFn = vi.fn();
    vi.stubGlobal('lynx', { queueMicrotask: vi.fn(fn => Promise.resolve().then(fn)) });

    const { lynxQueueMicrotask } = await import('../src/utils');
    lynxQueueMicrotask(mockFn);

    expect(lynx.queueMicrotask).toHaveBeenCalled();
    expect(mockFn).not.toHaveBeenCalled();

    await Promise.resolve().then(() => {});
    expect(mockFn).toHaveBeenCalled();
  });

  it('should fall back to Promise when lynx.queueMicrotask is not available', async () => {
    const mockFn = vi.fn();
    vi.stubGlobal('lynx', {});

    const { lynxQueueMicrotask } = await import('../src/utils');
    lynxQueueMicrotask(mockFn);

    expect(mockFn).not.toHaveBeenCalled();

    await Promise.resolve().then(() => {});
    expect(mockFn).toHaveBeenCalled();
  });
});
