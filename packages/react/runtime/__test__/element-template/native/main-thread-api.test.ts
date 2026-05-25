import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectCalledByNative } from '../../../src/element-template/native/main-thread-api.js';
import { reloadMainThread } from '../../../src/element-template/native/reload.js';
import { createElementTemplatePage, setupPage } from '../../../src/element-template/runtime/page/page.js';
import {
  renderMainThread,
  resetMainThreadRootRefs,
} from '../../../src/element-template/runtime/render/render-main-thread.js';

const mockedPageModuleState = vi.hoisted(() => ({
  page: undefined as unknown,
}));

vi.mock('../../../src/element-template/runtime/page/page.js', () => ({
  get __page() {
    return mockedPageModuleState.page;
  },
  createElementTemplatePage: vi.fn(() => ({ type: 'page', id: '0', children: [] })),
  setupPage: vi.fn((page: unknown) => {
    mockedPageModuleState.page = page;
  }),
}));

vi.mock('../../../src/element-template/runtime/render/render-main-thread.js', () => ({
  renderMainThread: vi.fn(),
  resetMainThreadRootRefs: vi.fn(),
}));

vi.mock('../../../src/element-template/native/reload.js', () => ({
  reloadMainThread: vi.fn(),
}));

describe('injectCalledByNative', () => {
  beforeEach(() => {
    mockedPageModuleState.page = undefined;
    globalThis.__FIRST_SCREEN_SYNC_TIMING__ = 'immediately';
    vi.mocked(createElementTemplatePage).mockReturnValue(
      { type: 'page', id: '0', children: [] } as unknown as ElementRef,
    );
    vi.stubGlobal('__FlushElementTree', vi.fn());
    (globalThis as typeof globalThis & { lynx: typeof lynx & { __initData?: unknown } }).lynx = {
      ...(globalThis.lynx ?? {}),
      __initData: undefined,
    } as typeof lynx & { __initData?: unknown };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('should set getPageData returning null', () => {
    injectCalledByNative();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const globalAny = globalThis as any;
    expect(globalAny.getPageData).toBeDefined();
    expect(globalAny.getPageData()).toBeNull();

    expect(() => globalAny.updatePage()).not.toThrow();
    expect(() => globalAny.updateGlobalProps()).not.toThrow();
    expect(() => globalAny.removeComponents()).not.toThrow();
  });

  it('wires renderPage through initData, setupPage and renderMainThread', () => {
    injectCalledByNative();
    const globalAny = globalThis as typeof globalThis & {
      renderPage: (data?: Record<string, unknown>) => void;
    };

    globalAny.renderPage({ answer: 42 });

    expect(globalThis.lynx.__initData).toEqual({ answer: 42 });
    expect(vi.mocked(createElementTemplatePage)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(setupPage)).toHaveBeenCalledWith({ type: 'page', id: '0', children: [] });
    expect(vi.mocked(resetMainThreadRootRefs)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(renderMainThread)).toHaveBeenCalledTimes(1);
  });

  it('merges updatePage data into initData and flushes the current page', () => {
    injectCalledByNative();
    const globalAny = globalThis as typeof globalThis & {
      renderPage: (data?: Record<string, unknown>) => void;
      updatePage: (data?: Record<string, unknown>, options?: UpdatePageOption) => void;
    };
    const page = { type: 'page', id: '0', children: [] };
    vi.mocked(createElementTemplatePage).mockReturnValue(page as unknown as ElementRef);
    globalAny.renderPage({ msg: 'init', stable: true });
    vi.mocked(renderMainThread).mockClear();

    const options = { pipelineOptions: { pipelineID: 'pipeline-1' } };
    globalAny.updatePage({ msg: 'update', next: 1 }, options);

    expect(globalThis.lynx.__initData).toEqual({ msg: 'update', stable: true, next: 1 });
    expect(__FlushElementTree).toHaveBeenCalledWith(page, options);
    expect(vi.mocked(renderMainThread)).not.toHaveBeenCalled();
    expect(options).not.toHaveProperty('triggerDataUpdated');
  });

  it('clears initData before resetPageData updates', () => {
    injectCalledByNative();
    const globalAny = globalThis as typeof globalThis & {
      renderPage: (data?: Record<string, unknown>) => void;
      updatePage: (data?: Record<string, unknown>, options?: UpdatePageOption) => void;
    };
    const page = { type: 'page', id: '0', children: [] };
    vi.mocked(createElementTemplatePage).mockReturnValue(page as unknown as ElementRef);
    globalAny.renderPage({ stale: true, msg: 'init' });

    globalAny.updatePage({ msg: 'reset' }, { resetPageData: true });

    expect(globalThis.lynx.__initData).toEqual({ msg: 'reset' });
    expect(__FlushElementTree).toHaveBeenLastCalledWith(page, { resetPageData: true });
  });

  it('keeps initData unchanged for empty or non-object updatePage data', () => {
    injectCalledByNative();
    const globalAny = globalThis as typeof globalThis & {
      renderPage: (data?: Record<string, unknown>) => void;
      updatePage: (data?: Record<string, unknown>, options?: UpdatePageOption) => void;
    };
    const page = { type: 'page', id: '0', children: [] };
    vi.mocked(createElementTemplatePage).mockReturnValue(page as unknown as ElementRef);
    globalAny.renderPage({ msg: 'init' });

    globalAny.updatePage({});
    globalAny.updatePage(null as unknown as Record<string, unknown>);
    globalAny.updatePage('ignored' as unknown as Record<string, unknown>);

    expect(globalThis.lynx.__initData).toEqual({ msg: 'init' });
    expect(__FlushElementTree).toHaveBeenLastCalledWith(page, {});
  });

  it('routes reloadTemplate through the reload main-thread path', () => {
    injectCalledByNative();
    const globalAny = globalThis as typeof globalThis & {
      renderPage: (data?: Record<string, unknown>) => void;
      updatePage: (data?: Record<string, unknown>, options?: UpdatePageOption) => void;
    };
    globalAny.renderPage({ msg: 'init' });
    vi.mocked(__FlushElementTree).mockClear();

    globalAny.updatePage({ msg: 'reload' }, { reloadTemplate: true });

    expect(vi.mocked(reloadMainThread)).toHaveBeenCalledWith({ msg: 'reload' }, { reloadTemplate: true });
    expect(globalThis.lynx.__initData).toEqual({ msg: 'init' });
    expect(__FlushElementTree).not.toHaveBeenCalled();
  });

  it('keeps non-immediately timing outside the Phase 1 ordinary updatePage path', () => {
    injectCalledByNative();
    const globalAny = globalThis as typeof globalThis & {
      renderPage: (data?: Record<string, unknown>) => void;
      updatePage: (data?: Record<string, unknown>, options?: UpdatePageOption) => void;
    };
    globalAny.renderPage({ msg: 'init' });
    globalThis.__FIRST_SCREEN_SYNC_TIMING__ = 'jsReady';
    vi.mocked(__FlushElementTree).mockClear();

    globalAny.updatePage({ msg: 'update' });
    globalAny.updatePage({ msg: 'reload' }, { reloadTemplate: true });

    expect(globalThis.lynx.__initData).toEqual({ msg: 'init' });
    expect(__FlushElementTree).not.toHaveBeenCalled();
    expect(vi.mocked(reloadMainThread)).not.toHaveBeenCalled();
  });
});
