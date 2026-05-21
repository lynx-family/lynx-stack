import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('ElementTemplate page root helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('__CreateTypedElementTemplate', vi.fn());
    vi.stubGlobal('__InsertNodeToElementTemplate', vi.fn());
    vi.stubGlobal('__RemoveNodeFromElementTemplate', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates typed page and updates its root slot', async () => {
    const page = { type: 'page' } as unknown as ElementRef;
    const rootRef = { type: 'root' } as unknown as ElementRef;
    vi.mocked(__CreateTypedElementTemplate).mockReturnValue(page);

    const {
      createElementTemplatePage,
      insertRootIntoPage,
      removeRootFromPage,
      setupPage,
    } = await import('../../../../src/element-template/runtime/page/page.js');

    expect(createElementTemplatePage()).toBe(page);
    expect(__CreateTypedElementTemplate).toHaveBeenCalledWith('page', null, null, '0', null);

    setupPage(page);
    insertRootIntoPage(rootRef);
    removeRootFromPage(rootRef);

    expect(__InsertNodeToElementTemplate).toHaveBeenCalledWith(page, 0, rootRef, null);
    expect(__RemoveNodeFromElementTemplate).toHaveBeenCalledWith(page, 0, rootRef);
  });
});
