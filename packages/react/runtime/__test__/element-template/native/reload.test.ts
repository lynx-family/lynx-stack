import { afterEach, beforeEach, describe, expect, it, rstest, rstest } from '@rstest/core';

import { increaseReloadVersion } from '../../../src/core/reload-version.js';
import { setupBackgroundElementTemplateDocument } from '../../../src/element-template/background/document.js';
import { destroyElementTemplateBackgroundRuntime } from '../../../src/element-template/background/destroy.js';
import { installElementTemplateHydrationListener } from '../../../src/element-template/background/hydration-listener.js';
import { BackgroundElementTemplateInstance } from '../../../src/element-template/background/instance.js';
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
  clearMainThreadDynamicAttrState,
  getMainThreadDynamicAttrState,
  initializeMainThreadDynamicAttrSlots,
} from '../../../src/element-template/runtime/template/main-thread-dynamic-attr-state.js';
import {
  __etAttrPlanMap,
  adaptMTEventAttrSlot,
  clearEtAttrPlanMap,
} from '../../../src/element-template/runtime/template/attr-slot-plan.js';
import {
  renderMainThread,
  resetMainThreadRootRefs,
} from '../../../src/element-template/runtime/render/render-main-thread.js';
import { render as mockRender } from '../../../src/element-template/runtime/render/render-to-opcodes.js';
import { renderOpcodesIntoElementTemplate as mockRenderOpcodesIntoElementTemplate } from '../../../src/element-template/runtime/render/render-opcodes.js';
import { render as preactRender } from 'preact';

const mockedState = rstest.hoisted(() => ({
  page: undefined as unknown,
  root: {} as { __jsx?: unknown; stale?: boolean },
}));

rstest.mock('../../../src/core/reload-version.js', () => ({
  getReloadVersion: rstest.fn(() => 1),
  increaseReloadVersion: rstest.fn(),
}));

rstest.mock('../../../src/element-template/runtime/page/page.js', () => ({
  get __page() {
    return mockedState.page;
  },
  setupPage: rstest.fn((page: unknown) => {
    mockedState.page = page;
  }),
  insertRootIntoPage: rstest.fn((rootRef: ElementRef) => {
    __InsertNodeToElementTemplate(mockedState.page as ElementRef, 0, rootRef, null);
  }),
  removeRootFromPage: rstest.fn((rootRef: ElementRef) => {
    __RemoveNodeFromElementTemplate(mockedState.page as ElementRef, 0, rootRef);
  }),
}));

rstest.mock('../../../src/element-template/runtime/page/root-instance.js', () => ({
  get __root() {
    return mockedState.root;
  },
  setRoot: rstest.fn((root: typeof mockedState.root) => {
    mockedState.root = root;
  }),
}));

rstest.mock('../../../src/element-template/runtime/render/render-to-opcodes.js', () => ({
  render: rstest.fn(),
  registerSlot: rstest.fn(),
}));

rstest.mock('../../../src/element-template/runtime/render/render-opcodes.js', () => ({
  renderOpcodesIntoElementTemplate: rstest.fn(),
}));

rstest.mock('../../../src/element-template/runtime/template/registry.js', () => ({
  elementTemplateRegistry: {
    clear: rstest.fn(),
  },
}));

rstest.mock('../../../src/element-template/runtime/template/handle.js', () => ({
  resetTemplateId: rstest.fn(),
}));

rstest.mock('../../../src/element-template/runtime/list/list.js', () => ({
  destroyAllElementTemplateListStates: rstest.fn(),
  flushInitialElementTemplateListUpdates: rstest.fn(() => []),
}));

rstest.mock('../../../src/element-template/background/destroy.js', () => ({
  destroyElementTemplateBackgroundRuntime: rstest.fn(),
}));

rstest.mock('../../../src/element-template/background/document.js', () => ({
  setupBackgroundElementTemplateDocument: rstest.fn(),
}));

rstest.mock('../../../src/element-template/background/hydration-listener.js', () => ({
  installElementTemplateHydrationListener: rstest.fn(),
}));

rstest.mock('../../../src/element-template/prop-adapters/event.js', () => ({
  resetEventStateForRuntime: rstest.fn(),
}));

rstest.mock('../../../src/element-template/background/instance.js', () => ({
  BackgroundElementTemplateInstance: class BackgroundElementTemplateInstance {
    constructor(public type: string) {}
  },
}));

rstest.mock('../../../src/element-template/debug/profile.js', () => ({
  profileEnd: rstest.fn(),
  profileStart: rstest.fn(),
}));

rstest.mock('preact', () => ({
  render: rstest.fn(),
}));

describe('ElementTemplate reloadMainThread', () => {
  beforeEach(() => {
    rstest.clearAllMocks();
    resetMainThreadRootRefs();
    mockedState.page = undefined;
    mockedState.root = {};
    clearMainThreadDynamicAttrState();
    clearEtAttrPlanMap();
    rstest.stubGlobal('__PROFILE__', false);
    rstest.stubGlobal('__FlushElementTree', rstest.fn());
    rstest.stubGlobal('__InsertNodeToElementTemplate', rstest.fn());
    rstest.stubGlobal('__RemoveNodeFromElementTemplate', rstest.fn());
    rstest.stubGlobal('__SerializeElementTemplate', rstest.fn());
    globalThis.lynx = {
      ...(globalThis.lynx ?? {}),
      __initData: {},
      reportError: rstest.fn(),
      getJSContext: rstest.fn(() => ({
        dispatchEvent: rstest.fn(),
      })),
    } as typeof lynx;
  });

  afterEach(() => {
    resetMainThreadRootRefs();
    rstest.unstubAllGlobals();
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
    const opcodes = [0, 'opcode'];
    const rootRef = { type: 'ref-a' } as unknown as ElementRef;
    const serializedRoot = {
      templateKey: '_et_reload',
      attributeSlots: [],
      elementSlots: [],
      uid: -1,
    };
    const dispatchEvent = rstest.fn();
    __etAttrPlanMap._et_old = [0, adaptMTEventAttrSlot];
    initializeMainThreadDynamicAttrSlots(-1, '_et_old', [{
      type: 'worklet',
      value: { _wkltId: 'old' },
    }]);
    expect(getMainThreadDynamicAttrState(-1, 0)).toBeDefined();
    rstest.mocked(mockRender).mockReturnValueOnce(['old-opcode']);
    rstest.mocked(mockRenderOpcodesIntoElementTemplate).mockReturnValueOnce({ rootRefs: [oldRootRef] });
    rstest.mocked(__SerializeElementTemplate).mockReturnValueOnce(
      oldSerializedRoot as ReturnType<typeof __SerializeElementTemplate>,
    );
    (globalThis.lynx as typeof lynx & { getJSContext?: () => { dispatchEvent: typeof dispatchEvent } })
      .getJSContext = rstest.fn(() => ({
        dispatchEvent,
      }));
    renderMainThread();

    rstest.mocked(__InsertNodeToElementTemplate).mockClear();
    rstest.mocked(__SerializeElementTemplate).mockClear();
    rstest.mocked(mockRender).mockClear();
    rstest.mocked(mockRenderOpcodesIntoElementTemplate).mockClear();
    dispatchEvent.mockClear();
    rstest.mocked(mockRender).mockReturnValue(opcodes);
    rstest.mocked(mockRenderOpcodesIntoElementTemplate).mockReturnValue({ rootRefs: [rootRef] });
    rstest.mocked(__SerializeElementTemplate).mockReturnValue(
      serializedRoot as ReturnType<typeof __SerializeElementTemplate>,
    );

    reloadMainThread(data, options);

    expect(increaseReloadVersion).toHaveBeenCalledTimes(1);
    expect(lynx.__initData).toBe(initData);
    expect(lynx.__initData).toEqual({ msg: 'reload', stable: true });
    expect(destroyAllElementTemplateListStates).toHaveBeenCalledTimes(1);
    expect(rstest.mocked(destroyAllElementTemplateListStates).mock.invocationCallOrder[0]!).toBeLessThan(
      rstest.mocked(elementTemplateRegistry.clear).mock.invocationCallOrder[0]!,
    );
    expect(elementTemplateRegistry.clear).toHaveBeenCalledTimes(1);
    expect(getMainThreadDynamicAttrState(-1, 0)).toBeUndefined();
    expect(resetTemplateId).toHaveBeenCalledTimes(1);
    expect(rstest.mocked(setupPage)).not.toHaveBeenCalled();
    expect(__RemoveNodeFromElementTemplate).toHaveBeenCalledWith(page, 0, oldRootRef);
    expect(rstest.mocked(setRoot)).toHaveBeenCalledTimes(1);
    expect(__root).not.toBe(oldRoot);
    expect(__root.__jsx).toBe(jsx);
    expect(__root).not.toHaveProperty('stale');
    expect(mockRender).toHaveBeenCalledWith(jsx, undefined);
    expect(mockRenderOpcodesIntoElementTemplate).toHaveBeenCalledWith(opcodes);
    expect(__InsertNodeToElementTemplate).toHaveBeenCalledWith(page, 0, rootRef, null);
    expect(__SerializeElementTemplate).toHaveBeenCalledWith(rootRef);
    expect(dispatchEvent).toHaveBeenCalledWith({
      type: 'rLynxElementTemplateHydrate',
      data: {
        instances: [serializedRoot],
        reloadVersion: expect.any(Number),
      },
    });
    expect(__FlushElementTree).toHaveBeenCalledWith(page, options);
  });

  it('clears delayed runOnBackground tasks during main-thread reload', () => {
    const delayedBackgroundFunctionArray = [{ task: rstest.fn() }];
    globalThis.lynxWorkletImpl = {
      ...(globalThis.lynxWorkletImpl ?? {}),
      _runOnBackgroundDelayImpl: {
        delayedBackgroundFunctionArray,
        clearDelayedBackgroundFunctions: rstest.fn(() => {
          delayedBackgroundFunctionArray.length = 0;
        }),
      },
    } as typeof globalThis.lynxWorkletImpl;
    mockedState.root = { __jsx: null };
    rstest.mocked(mockRender).mockReturnValue([]);
    rstest.mocked(mockRenderOpcodesIntoElementTemplate).mockReturnValue({ rootRefs: [] });

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
    rstest.mocked(mockRender).mockReturnValue(['opcode']);
    rstest.mocked(mockRenderOpcodesIntoElementTemplate).mockImplementationOnce(() => {
      __etAttrPlanMap._et_reload = [0, adaptMTEventAttrSlot];
      initializeMainThreadDynamicAttrSlots(-2, '_et_reload', [{
        type: 'worklet',
        value: ctx,
      }]);
      return { rootRefs: [rootRef] };
    });
    rstest.mocked(__FlushElementTree).mockImplementationOnce(() => {
      throw new Error('flush failed');
    });

    expect(() => reloadMainThread({ msg: 'reload' }, { reloadTemplate: true })).toThrow('flush failed');

    expect(getMainThreadDynamicAttrState(-2, 0)?.nativeHeldValue).toBe(ctx);
  });

  it('clears initData before resetPageData main-thread reloads', () => {
    mockedState.root = { __jsx: { type: 'App' } };
    lynx.__initData = { stale: true, msg: 'init' };
    mockedState.page = { type: 'page', id: '0', children: [] };
    rstest.mocked(mockRender).mockReturnValue([]);
    rstest.mocked(mockRenderOpcodesIntoElementTemplate).mockReturnValue({ rootRefs: [] });

    reloadMainThread({ msg: 'reset' }, { reloadTemplate: true, resetPageData: true });

    expect(lynx.__initData).toEqual({ msg: 'reset' });
  });

  it('profiles main-thread reload when profiling is enabled', () => {
    rstest.stubGlobal('__PROFILE__', true);
    mockedState.root = { __jsx: null };
    rstest.mocked(mockRender).mockReturnValue([]);
    rstest.mocked(mockRenderOpcodesIntoElementTemplate).mockReturnValue({ rootRefs: [] });

    reloadMainThread(undefined, { reloadTemplate: true });

    expect(profileStart).toHaveBeenCalledWith('ReactLynx::reloadMainThread');
    expect(__FlushElementTree).toHaveBeenCalledTimes(1);
  });
});

describe('ElementTemplate reloadBackground', () => {
  beforeEach(() => {
    rstest.clearAllMocks();
    mockedState.root = {};
    globalThis.lynx = {
      ...(globalThis.lynx ?? {}),
      __initData: {},
      reportError: rstest.fn(),
      getJSContext: rstest.fn(),
    } as typeof lynx;
    rstest.stubGlobal('__PROFILE__', false);
  });

  afterEach(() => {
    rstest.unstubAllGlobals();
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
    expect(rstest.mocked(setRoot)).toHaveBeenCalledWith(expect.any(BackgroundElementTemplateInstance));
    expect(__root).toBeInstanceOf(BackgroundElementTemplateInstance);
    expect(__root).not.toBe(oldRoot);
    expect(__root.__jsx).toBe(jsx);
    expect(__root).not.toHaveProperty('stale');
    expect(setupBackgroundElementTemplateDocument).toHaveBeenCalledTimes(1);
    expect(installElementTemplateHydrationListener).toHaveBeenCalledTimes(1);
    expect(resetEventStateForRuntime).toHaveBeenCalledTimes(1);
    expect(preactRender).toHaveBeenCalledWith(jsx, __root);
  });

  it('profiles background reload with the Snapshot reload label', () => {
    rstest.stubGlobal('__PROFILE__', true);
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
