import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  renderMainThread,
  resetMainThreadRootRefs,
} from '../../../src/element-template/runtime/render/render-main-thread.js';
import { render as mockRender } from '../../../src/element-template/runtime/render/render-to-opcodes.js';
import { renderOpcodesIntoElementTemplate as mockRenderOpcodesIntoElementTemplate } from '../../../src/element-template/runtime/render/render-opcodes.js';
import { render as preactRender } from 'preact';

const mockedState = vi.hoisted(() => ({
  page: undefined as unknown,
  root: {} as { __jsx?: unknown; stale?: boolean },
}));

vi.mock('../../../src/core/reload-version.js', () => ({
  getReloadVersion: vi.fn(() => 1),
  increaseReloadVersion: vi.fn(),
}));

vi.mock('../../../src/element-template/runtime/page/page.js', () => ({
  get __page() {
    return mockedState.page;
  },
  setupPage: vi.fn((page: unknown) => {
    mockedState.page = page;
  }),
  insertRootIntoPage: vi.fn((rootRef: ElementRef) => {
    __InsertNodeToElementTemplate(mockedState.page as ElementRef, 0, rootRef, null);
  }),
  removeRootFromPage: vi.fn((rootRef: ElementRef) => {
    __RemoveNodeFromElementTemplate(mockedState.page as ElementRef, 0, rootRef);
  }),
}));

vi.mock('../../../src/element-template/runtime/page/root-instance.js', () => ({
  get __root() {
    return mockedState.root;
  },
  setRoot: vi.fn((root: typeof mockedState.root) => {
    mockedState.root = root;
  }),
}));

vi.mock('../../../src/element-template/runtime/render/render-to-opcodes.js', () => ({
  render: vi.fn(),
  registerSlot: vi.fn(),
}));

vi.mock('../../../src/element-template/runtime/render/render-opcodes.js', () => ({
  renderOpcodesIntoElementTemplate: vi.fn(),
}));

vi.mock('../../../src/element-template/runtime/template/registry.js', () => ({
  elementTemplateRegistry: {
    clear: vi.fn(),
  },
}));

vi.mock('../../../src/element-template/runtime/template/handle.js', () => ({
  resetTemplateId: vi.fn(),
}));

vi.mock('../../../src/element-template/runtime/list/list.js', () => ({
  destroyAllElementTemplateListStates: vi.fn(),
  flushInitialElementTemplateListUpdates: vi.fn(() => []),
}));

vi.mock('../../../src/element-template/background/destroy.js', () => ({
  destroyElementTemplateBackgroundRuntime: vi.fn(),
}));

vi.mock('../../../src/element-template/background/document.js', () => ({
  setupBackgroundElementTemplateDocument: vi.fn(),
}));

vi.mock('../../../src/element-template/background/hydration-listener.js', () => ({
  installElementTemplateHydrationListener: vi.fn(),
}));

vi.mock('../../../src/element-template/prop-adapters/event.js', () => ({
  resetEventStateForRuntime: vi.fn(),
}));

vi.mock('../../../src/element-template/background/instance.js', () => ({
  BackgroundElementTemplateInstance: class BackgroundElementTemplateInstance {
    constructor(public type: string) {}
  },
}));

vi.mock('../../../src/element-template/debug/profile.js', () => ({
  profileEnd: vi.fn(),
  profileStart: vi.fn(),
}));

vi.mock('preact', () => ({
  render: vi.fn(),
}));

describe('ElementTemplate reloadMainThread', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMainThreadRootRefs();
    mockedState.page = undefined;
    mockedState.root = {};
    vi.stubGlobal('__PROFILE__', false);
    vi.stubGlobal('__FlushElementTree', vi.fn());
    vi.stubGlobal('__InsertNodeToElementTemplate', vi.fn());
    vi.stubGlobal('__RemoveNodeFromElementTemplate', vi.fn());
    vi.stubGlobal('__SerializeElementTemplate', vi.fn());
    globalThis.lynx = {
      ...(globalThis.lynx ?? {}),
      __initData: {},
      reportError: vi.fn(),
      getJSContext: vi.fn(() => ({
        dispatchEvent: vi.fn(),
      })),
    } as typeof lynx;
  });

  afterEach(() => {
    resetMainThreadRootRefs();
    vi.unstubAllGlobals();
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
    const dispatchEvent = vi.fn();
    vi.mocked(mockRender).mockReturnValueOnce(['old-opcode']);
    vi.mocked(mockRenderOpcodesIntoElementTemplate).mockReturnValueOnce({ rootRefs: [oldRootRef] });
    vi.mocked(__SerializeElementTemplate).mockReturnValueOnce(
      oldSerializedRoot as ReturnType<typeof __SerializeElementTemplate>,
    );
    (globalThis.lynx as typeof lynx & { getJSContext?: () => { dispatchEvent: typeof dispatchEvent } })
      .getJSContext = vi.fn(() => ({
        dispatchEvent,
      }));
    renderMainThread();

    vi.mocked(__InsertNodeToElementTemplate).mockClear();
    vi.mocked(__SerializeElementTemplate).mockClear();
    vi.mocked(mockRender).mockClear();
    vi.mocked(mockRenderOpcodesIntoElementTemplate).mockClear();
    dispatchEvent.mockClear();
    vi.mocked(mockRender).mockReturnValue(opcodes);
    vi.mocked(mockRenderOpcodesIntoElementTemplate).mockReturnValue({ rootRefs: [rootRef] });
    vi.mocked(__SerializeElementTemplate).mockReturnValue(
      serializedRoot as ReturnType<typeof __SerializeElementTemplate>,
    );

    reloadMainThread(data, options);

    expect(increaseReloadVersion).toHaveBeenCalledTimes(1);
    expect(lynx.__initData).toBe(initData);
    expect(lynx.__initData).toEqual({ msg: 'reload', stable: true });
    expect(destroyAllElementTemplateListStates).toHaveBeenCalledTimes(1);
    expect(vi.mocked(destroyAllElementTemplateListStates).mock.invocationCallOrder[0]!).toBeLessThan(
      vi.mocked(elementTemplateRegistry.clear).mock.invocationCallOrder[0]!,
    );
    expect(elementTemplateRegistry.clear).toHaveBeenCalledTimes(1);
    expect(resetTemplateId).toHaveBeenCalledTimes(1);
    expect(vi.mocked(setupPage)).not.toHaveBeenCalled();
    expect(__RemoveNodeFromElementTemplate).toHaveBeenCalledWith(page, 0, oldRootRef);
    expect(vi.mocked(setRoot)).toHaveBeenCalledTimes(1);
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

  it('clears initData before resetPageData main-thread reloads', () => {
    mockedState.root = { __jsx: { type: 'App' } };
    lynx.__initData = { stale: true, msg: 'init' };
    mockedState.page = { type: 'page', id: '0', children: [] };
    vi.mocked(mockRender).mockReturnValue([]);
    vi.mocked(mockRenderOpcodesIntoElementTemplate).mockReturnValue({ rootRefs: [] });

    reloadMainThread({ msg: 'reset' }, { reloadTemplate: true, resetPageData: true });

    expect(lynx.__initData).toEqual({ msg: 'reset' });
  });

  it('profiles main-thread reload when profiling is enabled', () => {
    vi.stubGlobal('__PROFILE__', true);
    mockedState.root = { __jsx: null };
    vi.mocked(mockRender).mockReturnValue([]);
    vi.mocked(mockRenderOpcodesIntoElementTemplate).mockReturnValue({ rootRefs: [] });

    reloadMainThread(undefined, { reloadTemplate: true });

    expect(profileStart).toHaveBeenCalledWith('ReactLynx::reloadMainThread');
    expect(__FlushElementTree).toHaveBeenCalledTimes(1);
  });
});

describe('ElementTemplate reloadBackground', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedState.root = {};
    globalThis.lynx = {
      ...(globalThis.lynx ?? {}),
      __initData: {},
      reportError: vi.fn(),
      getJSContext: vi.fn(),
    } as typeof lynx;
    vi.stubGlobal('__PROFILE__', false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
    expect(vi.mocked(setRoot)).toHaveBeenCalledWith(expect.any(BackgroundElementTemplateInstance));
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
    vi.stubGlobal('__PROFILE__', true);
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
