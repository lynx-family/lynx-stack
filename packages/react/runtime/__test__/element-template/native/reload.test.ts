import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';

import { increaseReloadVersion } from '../../../src/core/reload-version.js';
import { setupBackgroundElementTemplateDocument } from '../../../src/element-template/background/document.js';
import { destroyElementTemplateBackgroundRuntime } from '../../../src/element-template/background/destroy.js';
import { installElementTemplateHydrationListener } from '../../../src/element-template/background/hydration-listener.js';
import { BackgroundPageRootInstance } from '../../../src/element-template/background/instance.js';
import { profileEnd, profileStart } from '../../../src/element-template/debug/profile.js';
import { reloadBackground } from '../../../src/element-template/native/reload-background.js';
import { reloadMainThread } from '../../../src/element-template/native/reload-main-thread.js';
import { resetEventStateForRuntime } from '../../../src/element-template/prop-adapters/event.js';
import { destroyAllElementTemplateListStates } from '../../../src/element-template/runtime/list/list.js';
import { setupPage } from '../../../src/element-template/runtime/page/page.js';
import { __root, setRoot } from '../../../src/element-template/runtime/page/root-instance.js';
import { elementTemplateRegistry } from '../../../src/element-template/runtime/template/registry.js';
import { resetTemplateId } from '../../../src/element-template/runtime/template/handle.js';
import {
  attachMainThreadDynamicAttrRefsForSubtree,
  clearMainThreadDynamicAttrState,
  getMainThreadDynamicAttrState,
  initializeMainThreadDynamicAttrSlots,
} from '../../../src/element-template/runtime/template/main-thread-dynamic-attr-state.js';
import {
  __etAttrPlanMap,
  adaptMTEventAttrSlot,
  adaptMTRefAttrSlot,
  clearEtAttrPlanMap,
} from '../../../src/element-template/runtime/template/attr-slot-plan.js';
import { renderMainThread } from '../../../src/element-template/runtime/render/render-main-thread.js';
import { render as mockRender } from '../../../src/element-template/runtime/render/render-to-opcodes.js';
import { renderOpcodesIntoElementTemplate as mockRenderOpcodesIntoElementTemplate } from '../../../src/element-template/runtime/render/render-opcodes.js';
import { render as preactRender } from 'preact';

const mockedState = rs.hoisted(() => ({
  page: undefined as unknown,
  root: {} as { __jsx?: unknown; stale?: boolean },
}));

rs.mock('../../../src/core/reload-version.js', () => ({
  getReloadVersion: rs.fn(() => 1),
  increaseReloadVersion: rs.fn(),
}));

rs.mock('../../../src/element-template/runtime/page/page.js', () => ({
  get __page() {
    return mockedState.page;
  },
  setupPage: rs.fn((page: unknown) => {
    mockedState.page = page;
  }),
}));

rs.mock('../../../src/element-template/runtime/page/root-instance.js', () => ({
  get __root() {
    return mockedState.root;
  },
  setRoot: rs.fn((root: typeof mockedState.root) => {
    mockedState.root = root;
  }),
}));

rs.mock('../../../src/element-template/runtime/render/render-to-opcodes.js', () => ({
  render: rs.fn(),
  registerSlot: rs.fn(),
}));

rs.mock('../../../src/element-template/runtime/render/render-opcodes.js', () => ({
  renderOpcodesIntoElementTemplate: rs.fn(),
}));

rs.mock('../../../src/element-template/runtime/template/registry.js', () => ({
  elementTemplateRegistry: {
    clear: rs.fn(),
    delete: rs.fn(),
    get: rs.fn(),
  },
}));

rs.mock('../../../src/element-template/runtime/template/handle.js', () => ({
  ...rs.requireActual<
    typeof import('../../../src/element-template/runtime/template/handle.js')
  >('../../../src/element-template/runtime/template/handle.js'),
  resetTemplateId: rs.fn(),
}));

rs.mock('../../../src/element-template/runtime/list/list.js', () => ({
  destroyAllElementTemplateListStates: rs.fn(),
  flushInitialElementTemplateListUpdates: rs.fn(() => []),
}));

rs.mock('../../../src/element-template/background/destroy.js', () => ({
  destroyElementTemplateBackgroundRuntime: rs.fn(),
}));

rs.mock('../../../src/element-template/background/document.js', () => ({
  setupBackgroundElementTemplateDocument: rs.fn(),
}));

rs.mock('../../../src/element-template/background/hydration-listener.js', () => ({
  installElementTemplateHydrationListener: rs.fn(),
}));

rs.mock('../../../src/element-template/prop-adapters/event.js', () => ({
  resetEventStateForRuntime: rs.fn(),
}));

rs.mock('../../../src/element-template/background/instance.js', () => {
  class BackgroundElementTemplateInstance {
    constructor(public type: string) {}
  }
  return {
    BackgroundElementTemplateInstance,
    BackgroundPageRootInstance: class BackgroundPageRootInstance extends BackgroundElementTemplateInstance {
      constructor() {
        super('root');
      }
    },
  };
});

rs.mock('../../../src/element-template/debug/profile.js', () => ({
  profileEnd: rs.fn(),
  profileStart: rs.fn(),
}));

rs.mock('preact', () => ({
  render: rs.fn(),
}));

describe('ElementTemplate reloadMainThread', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mockedState.page = { type: 'page', id: '0', children: [] };
    mockedState.root = {};
    clearMainThreadDynamicAttrState();
    clearEtAttrPlanMap();
    rs.stubGlobal('__PROFILE__', false);
    rs.stubGlobal('__FlushElementTree', rs.fn());
    rs.stubGlobal('__InsertNodeToElementTemplate', rs.fn());
    rs.stubGlobal('__RemoveNodeFromElementTemplate', rs.fn());
    rs.stubGlobal('__SerializeElementTemplate', rs.fn());
    rs.stubGlobal('__SetAttributeOfElementTemplate', rs.fn());
    rs.mocked(__SerializeElementTemplate).mockReturnValue({
      tag: 'page',
      attributes: null,
      elementSlots: [[]],
      uid: 0,
    } as ReturnType<typeof __SerializeElementTemplate>);
    globalThis.lynx = {
      ...(globalThis.lynx ?? {}),
      __initData: {},
      reportError: rs.fn(),
      getJSContext: rs.fn(() => ({
        dispatchEvent: rs.fn(),
      })),
    } as typeof lynx;
  });

  afterEach(() => {
    rs.unstubAllGlobals();
  });

  it('rebuilds main-thread ET state and flushes the current page', () => {
    const jsx = { type: 'App' };
    const oldRoot = { __jsx: jsx, stale: true };
    mockedState.root = oldRoot;
    const initData = { msg: 'init', stable: true };
    lynx.__initData = initData;
    const data = { msg: 'reload' };
    const options = { reloadTemplate: true, pipelineOptions: { pipelineID: 'reload-1' } };
    const page = { type: 'page', id: '0', children: [] };
    mockedState.page = page;
    const oldRootRef = { type: 'old-ref' } as unknown as ElementRef;
    const oldSerializedRoot = {
      templateKey: '_et_old',
      attributeSlots: [],
      elementSlots: [],
      uid: -1,
    };
    const oldSerializedPage = {
      tag: 'page',
      attributes: { id: 'background' },
      elementSlots: [[oldSerializedRoot]],
      uid: 0,
    };
    const opcodes = [0, 'opcode'];
    const rootRef = { type: 'ref-a' } as unknown as ElementRef;
    const serializedRoot = {
      templateKey: '_et_reload',
      attributeSlots: [],
      elementSlots: [],
      uid: -1,
    };
    const serializedPage = {
      tag: 'page',
      attributes: null,
      elementSlots: [[serializedRoot]],
      uid: 0,
    };
    const dispatchEvent = rs.fn();
    const mtRef = { _wvid: 7 };
    const updateWorkletRef = rs.fn();
    const previousWorkletImpl = globalThis.lynxWorkletImpl;
    globalThis.lynxWorkletImpl = {
      ...previousWorkletImpl,
      _refImpl: {
        updateWorkletRef,
      },
    } as typeof globalThis.lynxWorkletImpl;
    try {
      __etAttrPlanMap._et_old = [0, adaptMTEventAttrSlot, 1, adaptMTRefAttrSlot];
      initializeMainThreadDynamicAttrSlots(
        -1,
        '_et_old',
        [
          {
            type: 'worklet',
            value: { _wkltId: 'old' },
          },
          {
            type: 'main-thread-ref',
            value: mtRef,
          },
        ],
      );
      attachMainThreadDynamicAttrRefsForSubtree([{ uid: -1, ref: oldRootRef }]);
      expect(getMainThreadDynamicAttrState(-1, 0)).toBeDefined();
      expect(getMainThreadDynamicAttrState(-1, 1)).toBeDefined();
      rs.mocked(mockRender).mockReturnValueOnce(['old-opcode']);
      rs.mocked(mockRenderOpcodesIntoElementTemplate).mockReturnValueOnce({
        pageAttributes: { id: 'background' },
        rootRefs: [oldRootRef],
        rootSubtreeHandles: [[]],
      });
      rs.mocked(__SerializeElementTemplate).mockReturnValueOnce(
        oldSerializedPage as ReturnType<typeof __SerializeElementTemplate>,
      );
      (globalThis.lynx as typeof lynx & { getJSContext?: () => { dispatchEvent: typeof dispatchEvent } })
        .getJSContext = rs.fn(() => ({
          dispatchEvent,
        }));
      renderMainThread();

      rs.mocked(__InsertNodeToElementTemplate).mockClear();
      rs.mocked(__SetAttributeOfElementTemplate).mockClear();
      rs.mocked(__SerializeElementTemplate).mockClear();
      rs.mocked(mockRender).mockClear();
      rs.mocked(mockRenderOpcodesIntoElementTemplate).mockClear();
      dispatchEvent.mockClear();
      rs.mocked(mockRender).mockReturnValue(opcodes);
      rs.mocked(mockRenderOpcodesIntoElementTemplate).mockReturnValue({
        pageAttributes: null,
        rootRefs: [rootRef],
        rootSubtreeHandles: [[]],
      });
      rs.mocked(elementTemplateRegistry.get).mockReturnValue(oldRootRef);
      rs.mocked(__SerializeElementTemplate)
        .mockReturnValueOnce(oldSerializedPage as ReturnType<typeof __SerializeElementTemplate>)
        .mockReturnValueOnce(serializedPage as ReturnType<typeof __SerializeElementTemplate>);

      reloadMainThread(data, options);

      expect(increaseReloadVersion).toHaveBeenCalledTimes(1);
      expect(lynx.__initData).toBe(initData);
      expect(lynx.__initData).toEqual({ msg: 'reload', stable: true });
      expect(destroyAllElementTemplateListStates).toHaveBeenCalledTimes(1);
      expect(rs.mocked(destroyAllElementTemplateListStates).mock.invocationCallOrder[0]!).toBeLessThan(
        rs.mocked(elementTemplateRegistry.clear).mock.invocationCallOrder[0]!,
      );
      expect(elementTemplateRegistry.clear).toHaveBeenCalledTimes(1);
      expect(getMainThreadDynamicAttrState(-1, 0)).toBeUndefined();
      expect(getMainThreadDynamicAttrState(-1, 1)).toBeUndefined();
      expect(updateWorkletRef).toHaveBeenCalledWith(mtRef, null);
      expect(resetTemplateId).toHaveBeenCalledTimes(1);
      expect(rs.mocked(setupPage)).not.toHaveBeenCalled();
      expect(elementTemplateRegistry.get).toHaveBeenCalledWith(-1);
      expect(__RemoveNodeFromElementTemplate).toHaveBeenCalledWith(page, 0, oldRootRef);
      expect(__SetAttributeOfElementTemplate).toHaveBeenCalledWith(page, 0, null, null);
      expect(rs.mocked(setRoot)).toHaveBeenCalledTimes(1);
      expect(__root).not.toBe(oldRoot);
      expect(__root.__jsx).toBe(jsx);
      expect(__root).not.toHaveProperty('stale');
      expect(mockRender).toHaveBeenCalledWith(jsx, undefined);
      expect(mockRenderOpcodesIntoElementTemplate).toHaveBeenCalledWith(opcodes);
      expect(__InsertNodeToElementTemplate).toHaveBeenCalledWith(page, 0, rootRef, null);
      expect(__SerializeElementTemplate).toHaveBeenCalledTimes(2);
      expect(__SerializeElementTemplate).toHaveBeenNthCalledWith(1, page);
      expect(__SerializeElementTemplate).toHaveBeenNthCalledWith(2, page);
      expect(rs.mocked(__SerializeElementTemplate).mock.invocationCallOrder[0]).toBeLessThan(
        rs.mocked(__RemoveNodeFromElementTemplate).mock.invocationCallOrder[0]!,
      );
      expect(rs.mocked(__RemoveNodeFromElementTemplate).mock.invocationCallOrder[0]).toBeLessThan(
        rs.mocked(elementTemplateRegistry.clear).mock.invocationCallOrder[0]!,
      );
      expect(rs.mocked(__InsertNodeToElementTemplate).mock.invocationCallOrder[0]).toBeLessThan(
        rs.mocked(__SerializeElementTemplate).mock.invocationCallOrder[1]!,
      );
      expect(dispatchEvent).toHaveBeenCalledWith({
        type: 'rLynxElementTemplateHydrate',
        data: {
          page: serializedPage,
          reloadVersion: expect.any(Number),
        },
      });
      expect(__FlushElementTree).toHaveBeenCalledWith(page, options);
    } finally {
      globalThis.lynxWorkletImpl = previousWorkletImpl;
    }
  });

  it('rebuilds when the physical page has no root slot', () => {
    mockedState.root = { __jsx: null };
    rs.mocked(mockRender).mockReturnValue([]);
    rs.mocked(mockRenderOpcodesIntoElementTemplate).mockReturnValue({
      pageAttributes: null,
      rootRefs: [],
      rootSubtreeHandles: [],
    });
    rs.mocked(__SerializeElementTemplate)
      .mockReturnValueOnce({
        tag: 'page',
        attributes: null,
        elementSlots: null,
        uid: 0,
      } as ReturnType<typeof __SerializeElementTemplate>)
      .mockReturnValueOnce({
        tag: 'page',
        attributes: null,
        elementSlots: [[]],
        uid: 0,
      } as ReturnType<typeof __SerializeElementTemplate>);

    reloadMainThread(undefined, { reloadTemplate: true });

    expect(elementTemplateRegistry.get).not.toHaveBeenCalled();
    expect(__RemoveNodeFromElementTemplate).not.toHaveBeenCalled();
    expect(__SerializeElementTemplate).toHaveBeenCalledTimes(2);
  });

  it('clears delayed runOnBackground tasks during main-thread reload', () => {
    const delayedBackgroundFunctionArray = [{ task: rs.fn() }];
    globalThis.lynxWorkletImpl = {
      ...(globalThis.lynxWorkletImpl ?? {}),
      _runOnBackgroundDelayImpl: {
        delayedBackgroundFunctionArray,
        clearDelayedBackgroundFunctions: rs.fn(() => {
          delayedBackgroundFunctionArray.length = 0;
        }),
      },
    } as typeof globalThis.lynxWorkletImpl;
    mockedState.root = { __jsx: null };
    rs.mocked(mockRender).mockReturnValue([]);
    rs.mocked(mockRenderOpcodesIntoElementTemplate).mockReturnValue({
      pageAttributes: null,
      rootRefs: [],
      rootSubtreeHandles: [],
    });

    reloadMainThread(undefined, { reloadTemplate: true });

    expect(globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl.clearDelayedBackgroundFunctions).toHaveBeenCalledTimes(
      1,
    );
    expect(delayedBackgroundFunctionArray).toHaveLength(0);
  });

  it('keeps newly rendered main-thread dynamic attr state when reload flush throws after create succeeds', () => {
    const jsx = { type: 'App' };
    const oldRoot = { __jsx: jsx };
    mockedState.root = oldRoot;
    mockedState.page = { type: 'page', id: '0', children: [] };
    const ctx = { _wkltId: 'new' };
    const rootRef = { type: 'ref-a' } as unknown as ElementRef;
    rs.mocked(mockRender).mockReturnValue(['opcode']);
    rs.mocked(mockRenderOpcodesIntoElementTemplate).mockImplementationOnce(() => {
      __etAttrPlanMap._et_reload = [0, adaptMTEventAttrSlot];
      initializeMainThreadDynamicAttrSlots(
        -2,
        '_et_reload',
        [{
          type: 'worklet',
          value: ctx,
        }],
      );
      return { pageAttributes: null, rootRefs: [rootRef], rootSubtreeHandles: [[]] };
    });
    rs.mocked(__FlushElementTree).mockImplementationOnce(() => {
      throw new Error('flush failed');
    });

    expect(() => reloadMainThread({ msg: 'reload' }, { reloadTemplate: true })).toThrow('flush failed');

    expect(getMainThreadDynamicAttrState(-2, 0)?.nativeHeldValue).toBe(ctx);
  });

  it('cleans each removed root before a later root removal fails', () => {
    const firstRootRef = { type: 'first-root' } as unknown as ElementRef;
    const firstListRef = { type: 'first-list' } as unknown as ElementRef;
    const firstChildRef = { type: 'first-child' } as unknown as ElementRef;
    const secondRootRef = { type: 'second-root' } as unknown as ElementRef;
    const firstMTRef = { _wvid: 1 };
    const firstChildMTRef = { _wvid: 2 };
    const secondMTRef = { _wvid: 3 };
    const updateWorkletRef = rs.fn();
    const previousWorkletImpl = globalThis.lynxWorkletImpl;
    globalThis.lynxWorkletImpl = {
      ...previousWorkletImpl,
      _refImpl: { updateWorkletRef },
    } as typeof globalThis.lynxWorkletImpl;

    try {
      __etAttrPlanMap._et_first_root = [0, adaptMTRefAttrSlot];
      __etAttrPlanMap._et_first_child = [0, adaptMTRefAttrSlot];
      __etAttrPlanMap._et_second_root = [0, adaptMTRefAttrSlot];
      initializeMainThreadDynamicAttrSlots(
        -1,
        '_et_first_root',
        [{ type: 'main-thread-ref', value: firstMTRef }],
      );
      initializeMainThreadDynamicAttrSlots(
        -2,
        '_et_first_child',
        [{ type: 'main-thread-ref', value: firstChildMTRef }],
      );
      initializeMainThreadDynamicAttrSlots(
        -3,
        '_et_second_root',
        [{ type: 'main-thread-ref', value: secondMTRef }],
      );
      attachMainThreadDynamicAttrRefsForSubtree([
        { uid: -1, ref: firstRootRef },
        { uid: -2, ref: firstChildRef },
        { uid: -3, ref: secondRootRef },
      ]);
      const nativeRefs = new Map([
        [-1, firstRootRef],
        [-2, firstChildRef],
        [-3, secondRootRef],
        [-4, firstListRef],
      ]);
      rs.mocked(elementTemplateRegistry.get).mockImplementation(id => nativeRefs.get(id));
      rs.mocked(__SerializeElementTemplate).mockReturnValueOnce({
        tag: 'page',
        attributes: null,
        elementSlots: [[
          {
            templateKey: '_et_first_root',
            uid: -1,
            elementSlots: [null, [{
              tag: 'list',
              uid: -4,
              options: {
                listChildren: [{
                  templateKey: '_et_first_child',
                  uid: -2,
                }],
              },
            }]],
          },
          {
            templateKey: '_et_second_root',
            uid: -3,
          },
        ]],
        uid: 0,
      } as ReturnType<typeof __SerializeElementTemplate>);
      rs.mocked(__RemoveNodeFromElementTemplate).mockImplementation((_parent, _slot, child) => {
        if (child === secondRootRef) {
          throw new Error('remove second root failed');
        }
      });

      expect(() => reloadMainThread(undefined, { reloadTemplate: true })).toThrow('remove second root failed');

      expect(elementTemplateRegistry.delete).toHaveBeenCalledWith(-1);
      expect(elementTemplateRegistry.delete).toHaveBeenCalledWith(-4);
      expect(elementTemplateRegistry.delete).toHaveBeenCalledWith(-2);
      expect(elementTemplateRegistry.delete).not.toHaveBeenCalledWith(-3);
      expect(elementTemplateRegistry.clear).not.toHaveBeenCalled();
      expect(getMainThreadDynamicAttrState(-1, 0)).toBeUndefined();
      expect(getMainThreadDynamicAttrState(-2, 0)).toBeUndefined();
      expect(getMainThreadDynamicAttrState(-3, 0)).toEqual({
        kind: 'mt-ref',
        value: secondMTRef,
      });
      expect(updateWorkletRef).toHaveBeenCalledWith(firstMTRef, null);
      expect(updateWorkletRef).toHaveBeenCalledWith(firstChildMTRef, null);
      expect(updateWorkletRef).not.toHaveBeenCalledWith(secondMTRef, null);
    } finally {
      clearMainThreadDynamicAttrState();
      globalThis.lynxWorkletImpl = previousWorkletImpl;
    }
  });

  it('clears initData before resetPageData main-thread reloads', () => {
    mockedState.root = { __jsx: { type: 'App' } };
    lynx.__initData = { stale: true, msg: 'init' };
    mockedState.page = { type: 'page', id: '0', children: [] };
    rs.mocked(mockRender).mockReturnValue([]);
    rs.mocked(mockRenderOpcodesIntoElementTemplate).mockReturnValue({
      pageAttributes: null,
      rootRefs: [],
      rootSubtreeHandles: [],
    });

    reloadMainThread({ msg: 'reset' }, { reloadTemplate: true, resetPageData: true });

    expect(lynx.__initData).toEqual({ msg: 'reset' });
  });

  it('profiles main-thread reload when profiling is enabled', () => {
    rs.stubGlobal('__PROFILE__', true);
    mockedState.root = { __jsx: null };
    rs.mocked(mockRender).mockReturnValue([]);
    rs.mocked(mockRenderOpcodesIntoElementTemplate).mockReturnValue({
      pageAttributes: null,
      rootRefs: [],
      rootSubtreeHandles: [],
    });

    reloadMainThread(undefined, { reloadTemplate: true });

    expect(profileStart).toHaveBeenCalledWith('ReactLynx::reloadMainThread');
    expect(__FlushElementTree).toHaveBeenCalledTimes(1);
  });
});

describe('ElementTemplate reloadBackground', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mockedState.root = {};
    globalThis.lynx = {
      ...(globalThis.lynx ?? {}),
      __initData: {},
      reportError: rs.fn(),
      getJSContext: rs.fn(),
    } as typeof lynx;
    rs.stubGlobal('__PROFILE__', false);
  });

  afterEach(() => {
    rs.unstubAllGlobals();
  });

  it('destroys old background state, rebuilds root state and renders saved JSX', () => {
    const jsx = { type: 'App' };
    const oldRoot = { __jsx: jsx, stale: true };
    mockedState.root = oldRoot;
    const initData = { msg: 'init', stable: true };
    lynx.__initData = initData;
    const updateData = { msg: 'reload' };

    reloadBackground(updateData);

    expect(destroyElementTemplateBackgroundRuntime).toHaveBeenCalledTimes(1);
    expect(increaseReloadVersion).toHaveBeenCalledTimes(1);
    expect(lynx.__initData).not.toBe(initData);
    expect(lynx.__initData).toEqual({ msg: 'reload', stable: true });
    expect(rs.mocked(setRoot)).toHaveBeenCalledWith(expect.any(BackgroundPageRootInstance));
    expect(__root).toBeInstanceOf(BackgroundPageRootInstance);
    expect(__root).not.toBe(oldRoot);
    expect(__root.__jsx).toBe(jsx);
    expect(__root).not.toHaveProperty('stale');
    expect(setupBackgroundElementTemplateDocument).toHaveBeenCalledTimes(1);
    expect(installElementTemplateHydrationListener).toHaveBeenCalledTimes(1);
    expect(resetEventStateForRuntime).toHaveBeenCalledTimes(1);
    expect(preactRender).toHaveBeenCalledWith(jsx, __root);
  });

  it('profiles background reload with the Snapshot reload label', () => {
    rs.stubGlobal('__PROFILE__', true);
    mockedState.root = { __jsx: null };

    reloadBackground(undefined);

    expect(profileStart).toHaveBeenCalledWith('ReactLynx::reloadBackground');
    expect(profileEnd).toHaveBeenCalledTimes(1);
  });

  it('keeps background reload initData object fresh without merging non-object update data', () => {
    mockedState.root = { __jsx: null };
    const initData = { stable: true };
    lynx.__initData = initData;

    reloadBackground('ignored');

    expect(lynx.__initData).not.toBe(initData);
    expect(lynx.__initData).toEqual({ stable: true });
  });
});
