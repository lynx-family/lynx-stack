// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { runOnMainThread, useEffect } from '@lynx-js/react';
import { act, render } from '@lynx-js/react/testing-library';

import { spring } from '../src/mini/core/spring.js';
import { noopMT } from '../src/utils/noop.js';

describe('Spring', () => {
  let mockRegisteredMap: Map<string, CallableFunction>;

  beforeEach(() => {
    mockRegisteredMap = new Map<string, CallableFunction>();
    const mockImpl = (id: string) => mockRegisteredMap.get(id) ?? noopMT;

    Object.defineProperty(globalThis, 'runOnRegistered', {
      get: () => mockImpl,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as any).runOnRegistered;
  });

  test('should call registered springHandle', async () => {
    const mockSpring = vi.fn();
    mockRegisteredMap.set('springHandle', mockSpring);

    const App = () => {
      useEffect(() => {
        runOnMainThread(() => {
          'main thread';
          const options = { stiffness: 100, damping: 10 };
          spring(options);
        })();
      }, []);
      return <view />;
    };

    render(<App />, { enableMainThread: true, enableBackgroundThread: true });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(mockSpring).toHaveBeenCalledWith(
      expect.objectContaining({ stiffness: 100, damping: 10 }),
    );
  });
});
