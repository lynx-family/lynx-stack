import { describe, expect, it, vi } from 'vitest';

import { installOnMtsDestruction, onMtsDestruction } from '../../../src/element-template/native/mts-destroy.js';

type LynxWithNative = typeof globalThis & {
  lynx: {
    getNative?: () => {
      addEventListener: (type: string, handler: () => void) => void;
      removeEventListener: (type: string, handler: () => void) => void;
    };
  };
};

describe('mts-destroy', () => {
  it('registers and unregisters destruction listener when native exists', () => {
    const g = globalThis as LynxWithNative;
    const originalGetNative = g.lynx.getNative;
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();

    g.lynx.getNative = () => ({ addEventListener, removeEventListener });

    installOnMtsDestruction();
    expect(addEventListener).toHaveBeenCalledWith('__DestroyLifetime', onMtsDestruction);

    onMtsDestruction();
    expect(removeEventListener).toHaveBeenCalledWith('__DestroyLifetime', onMtsDestruction);

    g.lynx.getNative = originalGetNative;
  });

  it('does not throw when native is missing', () => {
    const g = globalThis as LynxWithNative;
    const originalGetNative = g.lynx.getNative;

    // Simulate missing native bridge
    g.lynx.getNative = undefined;

    expect(() => installOnMtsDestruction()).not.toThrow();
    expect(() => onMtsDestruction()).not.toThrow();

    g.lynx.getNative = originalGetNative;
  });

  it('does not throw when performance hooks are missing', () => {
    const g = globalThis as typeof globalThis & {
      lynx: typeof lynx & {
        performance: Partial<typeof lynx.performance>;
      };
    };
    const originalPerformance = g.lynx.performance;
    const removeEventListener = vi.fn();

    g.lynx.getNative = () => ({ addEventListener: vi.fn(), removeEventListener });
    g.lynx.performance = {};

    expect(() => onMtsDestruction()).not.toThrow();
    expect(removeEventListener).toHaveBeenCalledWith('__DestroyLifetime', onMtsDestruction);

    g.lynx.performance = originalPerformance;
  });
});
