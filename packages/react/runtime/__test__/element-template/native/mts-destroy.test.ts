import { afterEach, describe, expect, it, vi } from 'vitest';

import { installOnMtsDestruction, onMtsDestruction } from '../../../src/element-template/native/mts-destroy.js';
import { ElementTemplateRegistry } from '../../../src/element-template/runtime/template/registry.js';

type LynxWithNative = typeof globalThis & {
  lynx: {
    getNative?: () => {
      addEventListener: (type: string, handler: () => void) => void;
      removeEventListener: (type: string, handler: () => void) => void;
    };
  };
};

describe('mts-destroy', () => {
  afterEach(() => {
    ElementTemplateRegistry.clear();
    vi.doUnmock('../../../src/element-template/native/patch-listener.js');
    vi.doUnmock('../../../src/element-template/runtime/template/registry.js');
  });

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
    const originalGetNative = g.lynx.getNative;
    const originalPerformance = g.lynx.performance;
    const removeEventListener = vi.fn();

    try {
      g.lynx.getNative = () => ({ addEventListener: vi.fn(), removeEventListener });
      g.lynx.performance = {};

      expect(() => onMtsDestruction()).not.toThrow();
      expect(removeEventListener).toHaveBeenCalledWith('__DestroyLifetime', onMtsDestruction);
    } finally {
      g.lynx.getNative = originalGetNative;
      g.lynx.performance = originalPerformance;
    }
  });

  it('clears the element template registry on destruction', () => {
    const registryRef = {} as ElementRef;
    ElementTemplateRegistry.set(-1, registryRef);
    expect(ElementTemplateRegistry.get(-1)).toBe(registryRef);

    onMtsDestruction();

    expect(ElementTemplateRegistry.get(-1)).toBeUndefined();
  });

  it('clears registry and removes native listener even when patch listener reset throws', async () => {
    vi.resetModules();
    const resetError = new Error('patch listener reset failed');
    const clear = vi.fn();
    const removeEventListener = vi.fn();
    const g = globalThis as LynxWithNative;
    const originalGetNative = g.lynx.getNative;

    vi.doMock('../../../src/element-template/native/patch-listener.js', () => ({
      resetElementTemplatePatchListener: vi.fn(() => {
        throw resetError;
      }),
    }));
    vi.doMock('../../../src/element-template/runtime/template/registry.js', () => ({
      ElementTemplateRegistry: {
        clear,
      },
    }));

    try {
      g.lynx.getNative = () => ({ addEventListener: vi.fn(), removeEventListener });
      const { onMtsDestruction: onMtsDestructionWithThrowingReset } = await import(
        '../../../src/element-template/native/mts-destroy.js'
      );

      expect(() => onMtsDestructionWithThrowingReset()).toThrow(resetError);
      expect(clear).toHaveBeenCalledTimes(1);
      expect(removeEventListener).toHaveBeenCalledWith(
        '__DestroyLifetime',
        onMtsDestructionWithThrowingReset,
      );
    } finally {
      g.lynx.getNative = originalGetNative;
    }
  });
});
