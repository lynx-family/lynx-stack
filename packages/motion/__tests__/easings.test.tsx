// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { runOnMainThread, useEffect } from '@lynx-js/react';
import { act, render } from '@lynx-js/react/testing-library';

import * as Easings from '../src/mini/core/easings.js';
import { noopMT } from '../src/utils/noop.js';

describe('Easings', () => {
  let mockRegisteredMap: Map<string, CallableFunction>;

  beforeEach(() => {
    mockRegisteredMap = new Map<string, CallableFunction>();

    const mockImpl = (id: string) => mockRegisteredMap.get(id) ?? noopMT;

    // Define on globalThis (test runner env)
    // This should propagate or be shared with the simulated main thread env
    // or the 'registeredFunction.ts' is re-evaluating and using this global.
    Object.defineProperty(globalThis, 'runOnRegistered', {
      get: () => mockImpl,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Cleanup property
    delete (globalThis as any).runOnRegistered;
  });

  const easingFunctions = [
    'anticipate',
    'backIn',
    'backInOut',
    'backOut',
    'circIn',
    'circInOut',
    'circOut',
    'easeIn',
    'easeInOut',
    'easeOut',
    'linear',
  ] as const;

  test('should call registered functions correctly', async () => {
    // Setup mocks
    easingFunctions.forEach(name => {
      mockRegisteredMap.set(`${name}Handle`, (t: number) => {
        return t * 10;
      });
    });

    const App = () => {
      useEffect(() => {
        runOnMainThread(() => {
          'main thread';
          const res: Record<string, any> = {};

          res['linear'] = Easings.linear(0.5);
          res['easeIn'] = Easings.easeIn(0.5);
          res['easeOut'] = Easings.easeOut(0.5);
          res['easeInOut'] = Easings.easeInOut(0.5);
          res['circIn'] = Easings.circIn(0.5);
          res['circOut'] = Easings.circOut(0.5);
          res['circInOut'] = Easings.circInOut(0.5);
          res['backIn'] = Easings.backIn(0.5);
          res['backOut'] = Easings.backOut(0.5);
          res['backInOut'] = Easings.backInOut(0.5);
          res['anticipate'] = Easings.anticipate(0.5);

          (globalThis as any)._testResults = res;
        })();
      }, []);
      return <view />;
    };

    render(<App />, {
      enableMainThread: true,
      enableBackgroundThread: true,
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const capturedResults = (globalThis as any)._testResults;

    expect(capturedResults).toBeDefined();
    if (capturedResults) {
      Object.keys(capturedResults).forEach(key => {
        expect(capturedResults[key]).toBe(5);
      });
    }

    delete (globalThis as any)._testResults;
  });

  test('all easing functions should be exported', () => {
    // Test that all easing functions are exported and are functions or objects
    expect(Easings.anticipate).toBeDefined();
    expect(Easings.backIn).toBeDefined();
    expect(Easings.backInOut).toBeDefined();
    expect(Easings.backOut).toBeDefined();
    expect(Easings.circIn).toBeDefined();
    expect(Easings.circInOut).toBeDefined();
    expect(Easings.circOut).toBeDefined();
    expect(Easings.easeIn).toBeDefined();
    expect(Easings.easeInOut).toBeDefined();
    expect(Easings.easeOut).toBeDefined();
    expect(Easings.linear).toBeDefined();
  });
});
