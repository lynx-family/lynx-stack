// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { globalEnvManager } from './envManager.ts';

describe('runtimeProxy', () => {
  beforeEach(() => {
    globalEnvManager.resetEnv();
  });

  it('should dispatch event', () => {
    const event = vi.fn();
    lynx.getJSContext().addEventListener('event1', event);
    globalEnvManager.switchToBackground();
    lynx.getCoreContext().dispatchEvent({ type: 'event1', data: 'test' });
    expect(event).toBeCalledWith({ type: 'event1', data: 'test' });
    lynx.getJSContext().removeEventListener('event1', event);
  });

  it('should not trigger event when context mismatch', () => {
    const event = vi.fn();
    lynx.getJSContext().addEventListener('event1', event);
    lynx.getJSContext().dispatchEvent({ type: 'event1', data: 'test' });
    expect(event).not.toBeCalled();
    lynx.getJSContext().removeEventListener('event1', event);
  });

  it('should throw when dispatch event to the same context', () => {
    expect(() => {
      lynx.getCoreContext().dispatchEvent({ type: 'event1', data: 'test' });
    }).toThrow();
  });
});
