import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('ElementTemplate page root helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('__CreateTypedElementTemplate', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates and installs the typed page root', async () => {
    const page = { type: 'page' } as unknown as ElementTemplateHandle;
    vi.mocked(__CreateTypedElementTemplate).mockReturnValue(page);

    const pageModule = await import('../../../../src/element-template/runtime/page/page.js');

    expect(pageModule.createElementTemplatePage()).toBe(page);
    expect(__CreateTypedElementTemplate).toHaveBeenCalledWith('page', null, null, 0, null);

    pageModule.setupPage(page);
    expect(pageModule.__page).toBe(page);
  });
});
