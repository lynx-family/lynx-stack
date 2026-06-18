import { afterEach, describe, expect, it, rstest as vi, rstest } from '@rstest/core';

import { installOnMtsDestruction, onMtsDestruction } from '../../../src/element-template/native/mts-destroy.js';
import {
  composeElementTemplateListAttributes,
  createElementTemplateListState,
  registerElementTemplateListItem,
  registerElementTemplateListState,
} from '../../../src/element-template/runtime/list/list.js';
import {
  clearMainThreadDynamicAttrState,
  getMainThreadDynamicAttrState,
  initializeMainThreadDynamicAttrSlots,
} from '../../../src/element-template/runtime/template/main-thread-dynamic-attr-state.js';
import {
  __etAttrPlanMap,
  adaptMTEventAttrSlot,
  clearEtAttrPlanMap,
} from '../../../src/element-template/runtime/template/attr-slot-plan.js';
import { elementTemplateRegistry } from '../../../src/element-template/runtime/template/registry.js';

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
    elementTemplateRegistry.clear();
    clearMainThreadDynamicAttrState();
    clearEtAttrPlanMap();
    rstest.doUnmock('../../../src/element-template/native/patch-listener.js');
    rstest.doUnmock('../../../src/element-template/runtime/template/registry.js');
    vi.unstubAllGlobals();
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
    elementTemplateRegistry.set(-1, registryRef);
    __etAttrPlanMap._et_destroy = [0, adaptMTEventAttrSlot];
    initializeMainThreadDynamicAttrSlots(-1, '_et_destroy', [{
      type: 'worklet',
      value: { _wkltId: 'tap' },
    }]);
    expect(elementTemplateRegistry.get(-1)).toBe(registryRef);
    expect(getMainThreadDynamicAttrState(-1, 0)).toBeDefined();

    onMtsDestruction();

    expect(elementTemplateRegistry.get(-1)).toBeUndefined();
    expect(getMainThreadDynamicAttrState(-1, 0)).toBeUndefined();
  });

  it('clears delayed runOnBackground tasks on destruction', () => {
    const delayedBackgroundFunctionArray = [{ task: vi.fn() }];
    globalThis.lynxWorkletImpl = {
      ...(globalThis.lynxWorkletImpl ?? {}),
      _runOnBackgroundDelayImpl: {
        delayedBackgroundFunctionArray,
        clearDelayedBackgroundFunctions: vi.fn(() => {
          delayedBackgroundFunctionArray.length = 0;
        }),
      },
    } as typeof globalThis.lynxWorkletImpl;

    onMtsDestruction();

    expect(globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl.clearDelayedBackgroundFunctions).toHaveBeenCalledTimes(
      1,
    );
    expect(delayedBackgroundFunctionArray).toHaveLength(0);
  });

  it('marks list callbacks destroyed on main-thread runtime destruction', () => {
    const listRef = { __isNativeRef: true, id: 'list', __mockNativeId: 100 } as unknown as ElementRef;
    const itemRef = { __isNativeRef: true, id: 'item', __mockNativeId: 101 } as unknown as ElementRef;
    const insertNode = vi.fn();
    const removeNode = vi.fn();
    const flush = vi.fn();
    vi.stubGlobal('__InsertNodeToElementTemplate', insertNode);
    vi.stubGlobal('__RemoveNodeFromElementTemplate', removeNode);
    vi.stubGlobal('__FlushElementTree', flush);
    elementTemplateRegistry.set(100, listRef);
    elementTemplateRegistry.set(101, itemRef);
    registerElementTemplateListItem(101, itemRef, {
      templateKey: '_et_item',
      platformInfo: { 'item-key': 'a' },
    });
    const state = createElementTemplateListState([101]);
    registerElementTemplateListState(100, state, false, listRef);
    const attrs = composeElementTemplateListAttributes(null, state);
    const componentAtIndex = attrs['component-at-index'] as ComponentAtIndexCallback;
    const enqueueComponent = attrs['enqueue-component'] as EnqueueComponentCallback;

    onMtsDestruction();

    expect(componentAtIndex(listRef, 7, 0, 91, false)).toBe(-1);
    enqueueComponent(listRef, 7, 101);
    expect(insertNode).not.toHaveBeenCalled();
    expect(removeNode).not.toHaveBeenCalled();
    expect(flush).not.toHaveBeenCalled();
  });

  it('clears registry and removes native listener even when patch listener reset throws', async () => {
    rstest.resetModules();
    const resetError = new Error('patch listener reset failed');
    const clear = vi.fn();
    const removeEventListener = vi.fn();
    const g = globalThis as LynxWithNative;
    const originalGetNative = g.lynx.getNative;

    rstest.doMock('../../../src/element-template/native/patch-listener.js', () => ({
      resetElementTemplatePatchListener: vi.fn(() => {
        throw resetError;
      }),
    }));
    rstest.doMock('../../../src/element-template/runtime/template/registry.js', () => ({
      elementTemplateRegistry: {
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
