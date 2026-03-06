// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { vi } from 'vitest';

// Mock lynx global
globalThis.lynx = {
  getCoreContext: () => ({
    addEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
  getJSContext: () => ({
    addEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
  getNativeApp: () => ({
    createJSObjectDestructionObserver: vi.fn(),
  }),
};

// Mock other globals if needed
globalThis.lynxWorkletImpl = undefined;
