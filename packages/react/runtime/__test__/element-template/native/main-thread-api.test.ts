import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectCalledByNative } from '../../../src/element-template/native/main-thread-api.js';
import { setupPage } from '../../../src/element-template/runtime/page/page.js';
import { renderMainThread } from '../../../src/element-template/runtime/render/render-main-thread.js';

vi.mock('../../../src/element-template/runtime/page/page.js', () => ({
  setupPage: vi.fn(),
}));

vi.mock('../../../src/element-template/runtime/render/render-main-thread.js', () => ({
  renderMainThread: vi.fn(),
}));

describe('injectCalledByNative', () => {
  beforeEach(() => {
    vi.stubGlobal('__CreatePage', vi.fn(() => ({ type: 'page', id: '0', children: [] })));
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
    expect(__CreatePage).toHaveBeenCalledWith('0', 0);
    expect(vi.mocked(setupPage)).toHaveBeenCalledWith({ type: 'page', id: '0', children: [] });
    expect(vi.mocked(renderMainThread)).toHaveBeenCalledTimes(1);
  });
});
